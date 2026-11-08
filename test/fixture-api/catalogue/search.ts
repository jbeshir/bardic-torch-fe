import type { components } from "../../../app/api/schema.gen";
import { COLLECTIONS } from "./collections";
import { EVENTS } from "./events";
import { PERSONS, type RawPerson } from "./persons";
import { PIECES, pieceSummary, type RawPiece } from "./pieces";
import {
  compareSortKeys,
  letterCounts,
  letterOf,
  page,
  parseSearch,
  searchRank,
  titleSortKey,
  type Searchable,
} from "./text";
import {
  compareCollections,
  comparePersons,
  comparePieces,
  hasPage,
  personHasAffiliation,
  pieceHasTerm,
  pieceTermsCounted,
  publicAliasNames,
  publicTerm,
  serveCollectionSummary,
  servePersonSummary,
  VISIBLE_LINKS,
} from "./visibility";

/**
 * The catalogue's searchable lists, as the backend builds them: the faceted
 * piece search with its disjunctive counts, the person search, collections,
 * events and needs-work. Only public records are matched or counted
 * (visibility.ts); every list is paged with `limit` and `offset`, and its
 * order ends with the record's position in the data (the internal id), so
 * pages are stable.
 */

type Schemas = components["schemas"];

const PIECE_KINDS: readonly Schemas["PieceKind"][] = [
  "song",
  "poem",
  "story",
  "dance_music",
  "instrumental",
  "comedy",
];

const CONSERVATION_STATUSES: readonly Schemas["ConservationStatus"][] = [
  "unassessed",
  "low_risk",
  "endangered",
  "critically_endangered",
  "restricted",
];

/**
 * One filter of a search, and the facet it belongs to: a value's count
 * leaves out the filter of its own facet (term facets, `kind`,
 * `conservation_status`, `letter`). `q` and `stub` are plain filters.
 */
type Filter<T> = {
  readonly facet: string;
  readonly test: (entry: T) => boolean;
};

const termFacet = (facet: string) => `term:${facet}`;

/** Ranks, or null for no `q`; entries `q` doesn't match aren't in it. */
function ranks<T>(
  entries: readonly T[],
  q: string | null,
  searchable: (entry: T) => Searchable
): ReadonlyMap<T, number> | null {
  if (q === null) return null;
  const query = parseSearch(q);
  return new Map(
    entries.flatMap(entry => {
      const rank = searchRank(query, searchable(entry));
      return rank === null ? [] : [[entry, rank] as const];
    })
  );
}

/** Sorted by rank (with `sort=relevance`, or by default with `q`), then sort key. */
function ordered<T>(
  entries: readonly T[],
  rank: ReadonlyMap<T, number> | null,
  query: URLSearchParams,
  compare: (a: T, b: T) => number
): T[] {
  const byRelevance =
    rank !== null && (query.get("sort") ?? "relevance") === "relevance";
  return [...entries].sort(
    (a, b) =>
      (byRelevance ? (rank.get(a) ?? 0) - (rank.get(b) ?? 0) : 0) ||
      compare(a, b)
  );
}

const matching = <T>(filters: readonly Filter<T>[], except?: string) => {
  const kept = filters.filter(filter => filter.facet !== except);
  return (entry: T) => kept.every(filter => filter.test(entry));
};

function pieceFilters(
  query: URLSearchParams,
  rank: ReadonlyMap<RawPiece, number> | null
): Filter<RawPiece>[] {
  const filters: Filter<RawPiece>[] = [];
  const byFacet = new Map<string, Set<string>>();
  for (const slug of query.getAll("term")) {
    // The parser accepts public piece terms only.
    const facet = publicTerm(slug)?.facet ?? "";
    byFacet.set(facet, new Set([...(byFacet.get(facet) ?? []), slug]));
  }
  for (const [facet, slugs] of byFacet) {
    filters.push({
      facet: termFacet(facet),
      test: piece => [...slugs].some(slug => pieceHasTerm(piece, slug)),
    });
  }
  const kinds = query.getAll("kind");
  if (kinds.length > 0) {
    filters.push({
      facet: "kind",
      test: piece =>
        kinds.some(
          kind =>
            piece.kind === kind || piece.secondary_kinds.some(k => k === kind)
        ),
    });
  }
  const statuses = query.getAll("conservation_status");
  if (statuses.length > 0) {
    filters.push({
      facet: "conservation_status",
      test: piece => statuses.includes(piece.conservation_status),
    });
  }
  const stub = query.get("stub");
  if (stub !== null) {
    filters.push({
      facet: "stub",
      test: piece => piece.is_stub === (stub === "true"),
    });
  }
  const letter = query.get("letter");
  if (letter !== null) {
    filters.push({
      facet: "letter",
      test: piece => letterOf(titleSortKey(piece.title)) === letter,
    });
  }
  if (rank !== null) {
    filters.push({ facet: "q", test: piece => rank.has(piece) });
  }
  return filters;
}

/** Counts of each value, in `order`, above zero only. */
function enumCounts<T extends string>(
  order: readonly T[],
  pieces: readonly RawPiece[],
  has: (piece: RawPiece, value: T) => boolean
): { value: T; count: number }[] {
  return order.flatMap(value => {
    const count = pieces.filter(piece => has(piece, value)).length;
    return count > 0 ? [{ value, count }] : [];
  });
}

/**
 * Each public piece term's count, by slug: the pieces matching every
 * filter but its own facet's, tagged with it or a descendant (once each).
 */
function termCounts(
  filters: readonly Filter<RawPiece>[]
): Schemas["TermCount"][] {
  const counts = new Map<string, number>();
  const bases = new Map<string, readonly RawPiece[]>();
  const base = (facet: string) => {
    const cached = bases.get(facet);
    if (cached) return cached;
    const pieces = PIECES.filter(matching(filters, termFacet(facet)));
    bases.set(facet, pieces);
    return pieces;
  };
  const facets = new Set(
    PIECES.flatMap(piece =>
      [...pieceTermsCounted(piece)].map(slug => publicTerm(slug)?.facet ?? "")
    )
  );
  for (const facet of facets) {
    for (const piece of base(facet)) {
      for (const slug of pieceTermsCounted(piece)) {
        if (publicTerm(slug)?.facet === facet) {
          counts.set(slug, (counts.get(slug) ?? 0) + 1);
        }
      }
    }
  }
  return [...counts]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([slug, count]) => ({ slug, count }));
}

const pieceSearchable = (piece: RawPiece): Searchable => ({
  title: piece.title,
  aliases: piece.aliases.map(alias => alias.text),
  notes: piece.notes_md,
});

/** `GET /v1/pieces`: one page, the total, and the disjunctive facet counts. */
export function searchPieces(query: URLSearchParams): Schemas["PieceList"] {
  const rank = ranks(PIECES, query.get("q"), pieceSearchable);
  const filters = pieceFilters(query, rank);
  const found = ordered(
    PIECES.filter(matching(filters)),
    rank,
    query,
    comparePieces
  );
  return {
    data: page(found, query).map(piece => pieceSummary(piece.slug)),
    total: found.length,
    facets: {
      terms: termCounts(filters),
      kinds: enumCounts(
        PIECE_KINDS,
        PIECES.filter(matching(filters, "kind")),
        (piece, kind) =>
          piece.kind === kind || piece.secondary_kinds.includes(kind)
      ).map(({ value, count }) => ({ kind: value, count })),
      conservation_statuses: enumCounts(
        CONSERVATION_STATUSES,
        PIECES.filter(matching(filters, "conservation_status")),
        (piece, status) => piece.conservation_status === status
      ).map(({ value, count }) => ({ conservation_status: value, count })),
      letters: letterCounts(
        PIECES.filter(matching(filters, "letter")).map(piece =>
          titleSortKey(piece.title)
        )
      ),
    },
  };
}

/** Persons with no page are matched by name only: their aliases aren't public. */
const personSearchable = (person: RawPerson): Searchable => ({
  title: person.name,
  aliases: hasPage(person.slug) ? publicAliasNames(person) : [],
  notes: null,
});

/** `GET /v1/persons`: one page, the total and the letter counts. */
export function searchPersons(query: URLSearchParams): Schemas["PersonList"] {
  const rank = ranks(PERSONS, query.get("q"), personSearchable);
  const kinds = query.getAll("kind");
  const roles = query.getAll("role");
  const affiliation = query.get("affiliation");
  const letter = query.get("letter");
  const filters: Filter<RawPerson>[] = [
    { facet: "kind", test: p => kinds.length === 0 || kinds.includes(p.kind) },
    {
      facet: "role",
      test: p =>
        roles.length === 0 ||
        (hasPage(p.slug) &&
          (p.profile?.roles ?? []).some(role => roles.includes(role))),
    },
    {
      facet: "affiliation",
      test: p => affiliation === null || personHasAffiliation(p, affiliation),
    },
    { facet: "q", test: p => rank === null || rank.has(p) },
    {
      facet: "letter",
      test: p => letter === null || letterOf(p.name) === letter,
    },
  ];
  const found = ordered(
    PERSONS.filter(matching(filters)),
    rank,
    query,
    comparePersons
  );
  return {
    data: page(found, query).map(servePersonSummary),
    total: found.length,
    letters: letterCounts(
      PERSONS.filter(matching(filters, "letter")).map(p => p.name)
    ),
  };
}

/** `GET /v1/collections`: by sort name, a leading The, A or An ignored. */
export function listCollections(
  query: URLSearchParams
): Schemas["CollectionList"] {
  const kinds = query.getAll("kind");
  const ofKind = COLLECTIONS.filter(
    c => kinds.length === 0 || kinds.some(kind => kind === c.kind)
  );
  const letter = query.get("letter");
  const found = ofKind
    .filter(c => letter === null || letterOf(titleSortKey(c.name)) === letter)
    .sort(compareCollections);
  return {
    data: page(found, query).map(serveCollectionSummary),
    total: found.length,
    letters: letterCounts(ofKind.map(c => titleSortKey(c.name))),
  };
}

/** `GET /v1/events`: by name as written (events have no A–Z). */
export function listEvents(query: URLSearchParams): Schemas["EventList"] {
  const kind = query.get("kind");
  const found = EVENTS.map((event, index) => ({ event, index }))
    .filter(({ event }) => kind === null || event.kind === kind)
    .sort(
      (a, b) => compareSortKeys(a.event.name, b.event.name) || a.index - b.index
    )
    .map(({ event }) => ({
      slug: event.slug,
      name: event.name,
      kind: event.kind,
    }));
  return { data: [...page(found, query)], total: found.length };
}

// Needs-work ----------------------------------------------------------------

type Reason = Schemas["NeedsWorkReason"];

const REASONS: readonly Reason[] = [
  "stub",
  "unassessed",
  "missing_licensing",
  "dead_links",
];

const hasDeadLink = (kind: "piece" | "person", slug: string) =>
  VISIBLE_LINKS.some(
    link =>
      link.owner.kind === kind &&
      link.owner.slug === slug &&
      link.liveness === "dead"
  );

/** A restricted piece is listed only for being a stub. */
function pieceReasons(piece: RawPiece): Reason[] {
  const all: Record<Reason, boolean> = {
    stub: piece.is_stub,
    unassessed: piece.conservation_status === "unassessed",
    missing_licensing: piece.licensing_status === "unknown",
    dead_links: hasDeadLink("piece", piece.slug),
  };
  return REASONS.filter(
    reason =>
      all[reason] &&
      (piece.conservation_status !== "restricted" || reason === "stub")
  );
}

/** Persons with no page are never considered; licensing counts for community bards. */
function personReasons(person: RawPerson): Reason[] {
  if (!hasPage(person.slug)) return [];
  const all: Record<Reason, boolean> = {
    stub: person.is_stub,
    unassessed: false,
    missing_licensing:
      person.kind === "community_bard" &&
      person.profile?.licensing_status === "unknown",
    dead_links: hasDeadLink("person", person.slug),
  };
  return REASONS.filter(reason => all[reason]);
}

/** `GET /v1/needs-work`: pieces first, then persons, each by sort key. */
export function listNeedsWork(
  query: URLSearchParams
): Schemas["NeedsWorkList"] {
  const entries: Schemas["NeedsWorkEntry"][] = [
    ...[...PIECES].sort(comparePieces).map(piece => ({
      entity_type: "piece" as const,
      slug: piece.slug,
      title: piece.title,
      reasons: pieceReasons(piece),
    })),
    ...[...PERSONS].sort(comparePersons).map(person => ({
      entity_type: "person" as const,
      slug: person.slug,
      title: person.name,
      reasons: personReasons(person),
    })),
  ].filter(entry => entry.reasons.length > 0);
  const reason = query.get("reason");
  const found = entries.filter(
    entry => reason === null || entry.reasons.some(r => r === reason)
  );
  return {
    data: [...page(found, query)],
    total: found.length,
    counts: REASONS.map(r => ({
      reason: r,
      count: entries.filter(entry => entry.reasons.includes(r)).length,
    })),
  };
}
