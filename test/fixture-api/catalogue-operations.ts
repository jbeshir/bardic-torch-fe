import type { components } from "../../app/api/schema.gen";
import {
  collectionRef,
  COLLECTIONS,
  type RawCollection,
} from "./catalogue/collections";
import { eventSummary, EVENTS } from "./catalogue/events";
import { LINKS, type RawLink, type RawPerformance } from "./catalogue/links";
import {
  PERSONS,
  listedPerson,
  personSummary,
  rawPerson,
  type RawPerson,
} from "./catalogue/persons";
import {
  PIECES,
  pieceSummary,
  rawPiece,
  type RawPiece,
} from "./catalogue/pieces";
import { REVISIONS } from "./catalogue/revisions";
import { TERMS, termSummary, type RawTerm } from "./catalogue/terms";
import { errorBody, type FixtureResponse } from "./responses";

/**
 * The 17 catalogue reads the read pages call, each answering what the
 * backend would for this data: the data holds only what a public read
 * shows, so there is nothing to hide, redact or validate here. The router
 * checks every body against the spec.
 */

type Schemas = components["schemas"];
type Letter = Schemas["Letter"];

/** The backend's cap on a nested list. */
const CAP = 200;

const ok = (body: unknown): FixtureResponse => ({ status: 200, body });
const notFound = (entity: string): FixtureResponse => ({
  status: 404,
  body: errorBody("not_found", `${entity} not found`),
});

// Sorting, paging and lists ---------------------------------------------------

/** A title's sort key: lower case, no punctuation, one leading The, A or An skipped. */
const sortKey = (title: string) =>
  title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace("þ", "th")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/^(?:the|a|an)\s+/u, "")
    .replace(/[^\p{L}\p{N} ]/gu, "");

const letterOf = (title: string): Letter => {
  const first = sortKey(title).charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? (first as Letter) : "0";
};

const byKey =
  <T>(title: (item: T) => string) =>
  (a: T, b: T) =>
    sortKey(title(a)).localeCompare(sortKey(title(b)));

const sorted = <T>(items: readonly T[], title: (item: T) => string): T[] =>
  [...items].sort(byKey(title));

/** One page of `items`, from the request's `limit` (default 50) and `offset`. */
function slice<T>(items: readonly T[], query: URLSearchParams): T[] {
  const limit = Number(query.get("limit") ?? 50);
  const offset = Number(query.get("offset") ?? 0);
  return items.slice(offset, offset + limit);
}

/** Filters by name; a facet's own count leaves out its filter (`except`). */
type Filters<T> = Record<string, (item: T) => boolean>;

const matching = <T>(items: readonly T[], filters: Filters<T>, except = "") =>
  items.filter(item =>
    Object.entries(filters).every(
      ([name, test]) => name === except || test(item)
    )
  );

/** How many items file under each letter, `0` first, counts above zero only. */
function letterCounts(titles: readonly string[]): Schemas["LetterCount"][] {
  return ["0", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"]
    .map(letter => ({
      letter: letter as Letter,
      count: titles.filter(title => letterOf(title) === letter).length,
    }))
    .filter(({ count }) => count > 0);
}

/**
 * The one list read: items matching every filter, by sort key (with `q`,
 * title matches before alias and note matches), one page of them, the total
 * and the letter counts of the other filters' matches.
 */
function list<T, S>(
  items: readonly T[],
  filters: Filters<T>,
  query: URLSearchParams,
  title: (item: T) => string,
  serve: (item: T) => S
) {
  const q = query.get("q")?.toLowerCase();
  // `sort=title` (or `name`) turns the title-first ranking off.
  const sort = query.get("sort");
  const rank = (item: T) =>
    q &&
    sort !== "title" &&
    sort !== "name" &&
    title(item).toLowerCase().includes(q)
      ? 0
      : 1;
  const found = matching(items, filters).sort(
    (a, b) => rank(a) - rank(b) || byKey(title)(a, b)
  );
  return {
    data: slice(found, query).map(serve),
    total: found.length,
    letters: letterCounts(matching(items, filters, "letter").map(title)),
  };
}

/** The values of a repeated query parameter, as a filter, or none. */
const anyOf = <T>(
  query: URLSearchParams,
  name: string,
  has: (item: T, value: string) => boolean
): Filters<T> => {
  const values = query.getAll(name);
  return values.length > 0
    ? { [name]: item => values.some(value => has(item, value)) }
    : {};
};

const letterFilter = <T>(
  query: URLSearchParams,
  title: (item: T) => string
): Filters<T> => {
  const letter = query.get("letter");
  return letter === null
    ? {}
    : { letter: item => letterOf(title(item)) === letter };
};

// Terms -----------------------------------------------------------------------

const termOf = (slug: string) => TERMS.find(t => t.slug === slug);

/** A term and its ancestors, nearest first. */
function lineage(slug: string): RawTerm[] {
  const term = termOf(slug);
  return term ? [term, ...(term.parent ? lineage(term.parent) : [])] : [];
}

/** The terms in the order the API lists them: facets in the spec's order. */
const FACETS = [...new Set(TERMS.map(t => t.facet))];

const pieceTerms = (piece: RawPiece) =>
  new Set(piece.terms.flatMap(term => lineage(term).map(t => t.slug)));
const PIECE_TERMS = new Map(PIECES.map(p => [p.slug, pieceTerms(p)]));
const hasTerm = (piece: RawPiece, slug: string) =>
  PIECE_TERMS.get(piece.slug)?.has(slug) ?? false;

const personAffiliated = (person: RawPerson, slug: string) =>
  (person.profile?.affiliations ?? []).some(affiliation =>
    lineage(affiliation).some(t => t.slug === slug)
  );

const PIECES_BY_TITLE = sorted(PIECES, p => p.title);
const PERSONS_BY_NAME = sorted(PERSONS, p => p.name);

const counts = (slug: string) => ({
  piece_count: PIECES.filter(p => hasTerm(p, slug)).length,
  person_count: PERSONS.filter(p => personAffiliated(p, slug)).length,
});

// Pieces ----------------------------------------------------------------------

const PIECE_KINDS = [
  "song",
  "poem",
  "story",
  "dance_music",
  "instrumental",
] as const;

const CONSERVATION_STATUSES = [
  "unassessed",
  "low_risk",
  "endangered",
  "critically_endangered",
  "restricted",
] as const;

const hasKind = (piece: RawPiece, kind: string) => piece.kind === kind;

function listPieces(query: URLSearchParams): FixtureResponse {
  // A term filter is a piece term; anything else is the FE's "left out" case.
  const slugs = query.getAll("term");
  const unknown = slugs.find(
    slug => (termOf(slug)?.facet ?? "affiliation") === "affiliation"
  );
  if (unknown !== undefined) {
    return {
      status: 400,
      body: errorBody("invalid_request", `unknown term: ${unknown}`),
    };
  }
  const q = query.get("q")?.toLowerCase();
  const stub = query.get("stub");
  const filters: Filters<RawPiece> = {
    ...Object.fromEntries(
      FACETS.flatMap(facet => {
        const own = slugs.filter(slug => termOf(slug)?.facet === facet);
        return own.length === 0
          ? []
          : [[`term:${facet}`, (p: RawPiece) => own.some(s => hasTerm(p, s))]];
      })
    ),
    ...anyOf(query, "kind", hasKind),
    ...anyOf(
      query,
      "conservation_status",
      (piece, status) => piece.conservation_status === status
    ),
    ...(stub === null ? {} : { stub: p => p.is_stub === (stub === "true") }),
    ...letterFilter(query, (p: RawPiece) => p.title),
    ...(q
      ? {
          q: p =>
            [p.title, ...p.aliases.map(a => a.text), p.notes_md ?? ""].some(
              text => text.toLowerCase().includes(q)
            ),
        }
      : {}),
  };
  const { data, total, letters } = list(
    PIECES_BY_TITLE,
    filters,
    query,
    p => p.title,
    p => pieceSummary(p.slug)
  );
  const counted = (name: string, values: readonly string[], test = hasKind) =>
    values.flatMap(value => {
      const count = matching(PIECES, filters, name).filter(p =>
        test(p, value)
      ).length;
      return count > 0 ? [{ value, count }] : [];
    });
  return ok({
    data,
    total,
    facets: {
      terms: TERMS.flatMap(({ slug, facet }) => {
        const count = matching(PIECES, filters, `term:${facet}`).filter(p =>
          hasTerm(p, slug)
        ).length;
        return count > 0 ? [{ slug, count }] : [];
      }).sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)),
      kinds: counted("kind", PIECE_KINDS).map(({ value, count }) => ({
        kind: value as Schemas["PieceKind"],
        count,
      })),
      conservation_statuses: counted(
        "conservation_status",
        CONSERVATION_STATUSES,
        (p, status) => p.conservation_status === status
      ).map(({ value, count }) => ({
        conservation_status: value as Schemas["ConservationStatus"],
        count,
      })),
      letters,
    },
  } satisfies Schemas["PieceList"]);
}

// Links and performances ------------------------------------------------------

const linksOf = (kind: "piece" | "person", slug: string) =>
  LINKS.filter(l => l.owner.kind === kind && l.owner.slug === slug);

const eventOf = (slug: string | null) =>
  slug === null ? null : eventSummary(slug);

const performers = (slugs: readonly string[]) => slugs.map(personSummary);

function servePerformance(raw: RawPerformance): Schemas["PiecePerformance"] {
  return {
    year: raw.year,
    uploader: raw.uploader,
    description_verbatim: raw.description_verbatim,
    event: eventOf(raw.event),
    performers: performers(raw.performers),
  };
}

function personLink(link: RawLink): Schemas["PersonLink"] {
  return {
    url: link.url,
    title: link.title,
    description: link.description,
    platform: link.platform,
    place_type: link.place_type,
    collection:
      link.collection === null ? null : collectionRef(link.collection),
    locator: link.locator,
    liveness: link.liveness,
    last_checked_at: link.last_checked_at,
    archived_url: link.archived_url,
    roles: [...link.roles],
  };
}

const performanceLink = (link: RawLink): Schemas["PerformanceLink"] => ({
  url: link.url,
  title: link.title,
  platform: link.platform,
});

/** Every performance on a link, newest year first, unknown years last. */
const PERFORMANCES = LINKS.flatMap(link =>
  link.performances.map(performance => ({ link, performance }))
).sort((a, b) => {
  const [ay, by] = [a.performance.year, b.performance.year];
  return ay === by ? 0 : ay === null ? 1 : by === null ? -1 : by - ay;
});

const performed = (link: RawLink) =>
  link.owner.kind === "piece" ? pieceSummary(link.owner.slug) : null;

// Details ---------------------------------------------------------------------

/** When every fixture entity's current revision was approved. */
const UPDATED_AT = "2026-03-01T12:00:00Z";

function servePiece(raw: RawPiece): Schemas["Piece"] {
  return {
    ...pieceSummary(raw.slug),
    updated_at: UPDATED_AT,
    notes_md: raw.notes_md,
    version_notes_md: raw.version_notes_md,
    licensing_status: raw.licensing_status,
    licensing_notes_md: raw.licensing_notes_md,
    aliases: [...raw.aliases],
    terms: raw.terms
      .map((term, position) => ({ term, position }))
      .sort(
        (a, b) =>
          FACETS.indexOf(termOf(a.term)?.facet ?? "other") -
            FACETS.indexOf(termOf(b.term)?.facet ?? "other") ||
          a.position - b.position
      )
      .map(({ term }) => termSummary(term)),
    credits: raw.credits.map(credit => ({
      ...credit,
      person: credit.person === null ? null : personSummary(credit.person),
    })),
    links: linksOf("piece", raw.slug).map(link => ({
      ...personLink(link),
      performances: link.performances.map(servePerformance),
    })),
  };
}

function servePerson(raw: RawPerson): Schemas["Person"] {
  const identity = {
    ...listedPerson(raw.slug),
    status: raw.status,
    updated_at: UPDATED_AT,
  };
  const { profile } = raw;
  if (profile === null) return { ...identity, profile: null };
  const works = PIECES_BY_TITLE.flatMap(piece =>
    piece.credits
      .filter(c => c.person === raw.slug && c.attribution === "named")
      .map(c => ({
        piece: pieceSummary(piece.slug),
        role: c.role,
        certainty: c.certainty,
      }))
  );
  const performances = PERFORMANCES.filter(
    ({ link, performance }) =>
      performance.performers.includes(raw.slug) ||
      (link.owner.kind === "person" && link.owner.slug === raw.slug)
  ).map(({ link, performance }) => ({
    piece: performed(link),
    link: performanceLink(link),
    year: performance.year,
    event: eventOf(performance.event),
    description_verbatim: performance.description_verbatim,
  }));
  return {
    ...identity,
    profile: {
      notes_md: profile.notes_md,
      licensing_status: profile.licensing_status,
      licensing_notes_md: profile.licensing_notes_md,
      aliases: [...profile.aliases],
      roles: [...profile.roles],
      affiliations: profile.affiliations.map(termSummary),
      links: linksOf("person", raw.slug).map(personLink),
      works: works.slice(0, CAP),
      works_total: works.length,
      performances: performances.slice(0, CAP),
      performances_total: performances.length,
    },
  };
}

function serveTerm(term: RawTerm, query: URLSearchParams): Schemas["Term"] {
  const affiliation = term.facet === "affiliation";
  return {
    slug: term.slug,
    updated_at: UPDATED_AT,
    facet: term.facet,
    name: term.name,
    display_name: term.display_name,
    description_md: term.description_md,
    ancestors: lineage(term.slug)
      .slice(1)
      .reverse()
      .map(t => termSummary(t.slug)),
    children: TERMS.filter(t => t.parent === term.slug).map(child => ({
      term: termSummary(child.slug),
      ...counts(child.slug),
    })),
    related_affiliation:
      term.related_affiliation === null
        ? null
        : termSummary(term.related_affiliation),
    ...counts(term.slug),
    pieces: affiliation
      ? []
      : slice(
          PIECES_BY_TITLE.filter(p => hasTerm(p, term.slug)),
          query
        ).map(p => pieceSummary(p.slug)),
    persons: affiliation
      ? slice(
          PERSONS_BY_NAME.filter(p => personAffiliated(p, term.slug)),
          query
        ).map(p => listedPerson(p.slug))
      : [],
  };
}

const collectionSummary = (
  raw: RawCollection
): Schemas["CollectionSummary"] => ({
  id: raw.id,
  name: raw.name,
  kind: raw.kind,
  url: raw.url,
});

function serveCollection(raw: RawCollection): Schemas["Collection"] {
  const cited = sorted(
    LINKS.filter(l => l.collection === raw.id),
    l =>
      l.owner.kind === "piece"
        ? rawPiece(l.owner.slug).title
        : rawPerson(l.owner.slug).name
  ).map(link => ({
    piece: link.owner.kind === "piece" ? pieceSummary(link.owner.slug) : null,
    person:
      link.owner.kind === "person" ? personSummary(link.owner.slug) : null,
    url: link.url,
    title: link.title,
    locator: link.locator,
    roles: [...link.roles],
  }));
  return {
    ...collectionSummary(raw),
    updated_at: UPDATED_AT,
    description_md: raw.description_md,
    region: raw.region === null ? null : termSummary(raw.region),
    citations: cited.slice(0, CAP),
    citations_total: cited.length,
  };
}

function serveEvent(slug: string): Schemas["Event"] | undefined {
  if (!EVENTS.some(e => e.slug === slug)) return undefined;
  const performances = PERFORMANCES.filter(
    ({ performance }) => performance.event === slug
  ).map(({ link, performance }) => ({
    piece: performed(link),
    link: performanceLink(link),
    year: performance.year,
    performers: performers(performance.performers),
    description_verbatim: performance.description_verbatim,
  }));
  return {
    ...eventSummary(slug),
    updated_at: UPDATED_AT,
    performances: performances.slice(0, CAP),
    performances_total: performances.length,
  };
}

// Revisions -------------------------------------------------------------------

type EntityType = Schemas["Revision"]["entity_type"];

/** One page of an entity's revisions, newest first, or 404. */
function history(
  entity: EntityType,
  key: string,
  query: URLSearchParams
): FixtureResponse {
  const exists = {
    piece: () => PIECES.some(p => p.slug === key),
    person: () => PERSONS.some(p => p.slug === key),
    term: () => termOf(key) !== undefined,
    collection: () => COLLECTIONS.some(c => String(c.id) === key),
    event: () => EVENTS.some(e => e.slug === key),
  };
  if (!exists[entity]()) return notFound(entity);
  const revisions = REVISIONS.filter(
    r =>
      r.entity_type === entity &&
      (r.entity_type === "collection" ? String(r.entity.id) : r.entity.slug) ===
        key
  )
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
    .map(r => ({
      id: r.id,
      source: r.source,
      summary: r.summary,
      author: r.author,
      contributors: [...r.contributors],
      created_at: r.created_at,
    }));
  return ok({ data: slice(revisions, query), total: revisions.length });
}

// The table ---------------------------------------------------------------------

type Read = (
  params: Readonly<Record<string, string>>,
  query: URLSearchParams
) => FixtureResponse;

/** A detail read: the entity found by its path parameter, or 404. */
const detail =
  <T>(
    entity: string,
    find: (key: string) => T | undefined,
    serve: (found: T, query: URLSearchParams) => unknown,
    param = "slug"
  ): Read =>
  (params, query) => {
    const found = find(params[param] ?? "");
    return found === undefined ? notFound(entity) : ok(serve(found, query));
  };

const historyOf =
  (entity: EntityType, param = "slug"): Read =>
  (params, query) =>
    history(entity, params[param] ?? "", query);

// Needs work -------------------------------------------------------------------

const NEEDS_WORK_REASONS = [
  "stub",
  "unassessed",
  "missing_licensing",
  "dead_links",
] as const satisfies readonly Schemas["NeedsWorkReason"][];

const hasDeadLink = (kind: "piece" | "person", slug: string) =>
  LINKS.some(
    l => l.owner.kind === kind && l.owner.slug === slug && l.liveness === "dead"
  );

/** Every public piece, then person, needing work, with its reasons. */
function needingWork(): Schemas["NeedsWorkEntry"][] {
  const pieces = sorted(PIECES, p => p.title).map(p => ({
    entity_type: "piece" as const,
    slug: p.slug,
    title: p.title,
    reasons: NEEDS_WORK_REASONS.filter(reason =>
      p.conservation_status === "restricted"
        ? reason === "stub" && p.is_stub
        : {
            stub: p.is_stub,
            unassessed: p.conservation_status === "unassessed",
            missing_licensing: p.licensing_status === "unknown",
            dead_links: hasDeadLink("piece", p.slug),
          }[reason]
    ),
  }));
  const persons = sorted(
    PERSONS.filter(p => p.status !== "prefers_no_page"),
    p => p.name
  ).map(p => ({
    entity_type: "person" as const,
    slug: p.slug ?? "",
    title: p.name,
    reasons: NEEDS_WORK_REASONS.filter(
      reason =>
        ({
          stub: p.is_stub,
          unassessed: false,
          missing_licensing:
            p.kind === "community_bard" &&
            p.profile?.licensing_status === "unknown",
          dead_links: hasDeadLink("person", p.slug ?? ""),
        })[reason]
    ),
  }));
  return [...pieces, ...persons].filter(entry => entry.reasons.length > 0);
}

function listNeedsWork(query: URLSearchParams): FixtureResponse {
  const all = needingWork();
  const reason = query.get("reason");
  const chosen =
    reason === null
      ? all
      : all.filter(entry => (entry.reasons as string[]).includes(reason));
  return ok({
    data: slice(chosen, query),
    total: chosen.length,
    counts: NEEDS_WORK_REASONS.map(r => ({
      reason: r,
      count: all.filter(entry => entry.reasons.includes(r)).length,
    })),
  });
}

/** The reads, by the spec's operationId: its path template and its answer. */
export const CATALOGUE_READS = {
  listPieces: {
    path: "/v1/pieces",
    read: (_params, query) => listPieces(query),
  },
  getPiece: {
    path: "/v1/pieces/{slug}",
    read: detail(
      "piece",
      slug => PIECES.find(p => p.slug === slug),
      servePiece
    ),
  },
  listPersons: {
    path: "/v1/persons",
    read: (_params, query) => {
      const affiliation = query.get("affiliation");
      if (
        affiliation !== null &&
        termOf(affiliation)?.facet !== "affiliation"
      ) {
        return {
          status: 400,
          body: errorBody(
            "invalid_request",
            `unknown affiliation: ${affiliation}`
          ),
        };
      }
      const q = query.get("q")?.toLowerCase();
      const filters: Filters<RawPerson> = {
        ...anyOf<RawPerson>(query, "kind", (p, kind) => p.kind === kind),
        ...anyOf<RawPerson>(query, "role", (p, role) =>
          (p.profile?.roles ?? []).some(r => r === role)
        ),
        ...(affiliation === null
          ? {}
          : { affiliation: p => personAffiliated(p, affiliation) }),
        ...letterFilter(query, (p: RawPerson) => p.name),
        ...(q
          ? {
              q: p =>
                [p.name, ...(p.profile?.aliases ?? []).map(a => a.name)].some(
                  text => text.toLowerCase().includes(q)
                ),
            }
          : {}),
      };
      return ok(
        list(
          PERSONS_BY_NAME,
          filters,
          query,
          p => p.name,
          p => listedPerson(p.slug)
        )
      );
    },
  },
  getPerson: {
    path: "/v1/persons/{slug}",
    read: detail(
      "person",
      slug => PERSONS.find(p => p.slug === slug),
      servePerson
    ),
  },
  listTerms: {
    path: "/v1/terms",
    read: (_params, query) => {
      const facet = query.get("facet");
      return ok({
        data: TERMS.filter(t => facet === null || t.facet === facet).map(t => ({
          slug: t.slug,
          facet: t.facet,
          name: t.name,
          display_name: t.display_name,
          parent_slug: t.parent,
          ...counts(t.slug),
        })),
      });
    },
  },
  getTerm: {
    path: "/v1/terms/{slug}",
    read: detail("term", termOf, serveTerm),
  },
  listCollections: {
    path: "/v1/collections",
    read: (_params, query) => {
      const filters: Filters<RawCollection> = {
        ...anyOf<RawCollection>(query, "kind", (c, kind) => c.kind === kind),
        ...letterFilter(query, (c: RawCollection) => c.name),
      };
      return ok(
        list(COLLECTIONS, filters, query, c => c.name, collectionSummary)
      );
    },
  },
  getCollection: {
    path: "/v1/collections/{collection_id}",
    read: detail(
      "collection",
      id => COLLECTIONS.find(c => String(c.id) === id),
      serveCollection,
      "collection_id"
    ),
  },
  listEvents: {
    path: "/v1/events",
    read: (_params, query) => {
      const found = [...EVENTS]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(e => eventSummary(e.slug));
      return ok({ data: slice(found, query), total: found.length });
    },
  },
  getEvent: {
    path: "/v1/events/{slug}",
    read: detail("event", serveEvent, event => event),
  },
  listPieceRevisions: {
    path: "/v1/pieces/{slug}/history",
    read: historyOf("piece"),
  },
  listPersonRevisions: {
    path: "/v1/persons/{slug}/history",
    read: historyOf("person"),
  },
  listTermRevisions: {
    path: "/v1/terms/{slug}/history",
    read: historyOf("term"),
  },
  listCollectionRevisions: {
    path: "/v1/collections/{collection_id}/history",
    read: historyOf("collection", "collection_id"),
  },
  listEventRevisions: {
    path: "/v1/events/{slug}/history",
    read: historyOf("event"),
  },
  getRevision: {
    path: "/v1/revisions/{revision_id}",
    read: detail(
      "revision",
      id => REVISIONS.find(r => String(r.id) === id),
      revision => revision,
      "revision_id"
    ),
  },
  listNeedsWork: {
    path: "/v1/needs-work",
    read: (_params, query) => listNeedsWork(query),
  },
} satisfies Record<string, { path: string; read: Read }>;
