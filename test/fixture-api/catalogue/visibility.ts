import type { components } from "../../../app/api/schema.gen";
import { collectionRef, COLLECTIONS, type RawCollection } from "./collections";
import { eventSummary, EVENTS, type RawEvent } from "./events";
import { LINKS, type RawLink, type RawPerformance } from "./links";
import {
  PERSON_RELATIONS,
  PERSONS,
  personSummary,
  rawPerson,
  type RawPerson,
} from "./persons";
import {
  PIECE_RELATIONS,
  PIECES,
  pieceSummary,
  rawPiece,
  type RawPiece,
} from "./pieces";
import type { TermFacet } from "./query";
import { changedFields, REVISIONS, UNAPPROVED_REVISIONS } from "./revisions";
import { TERMS, termSummary, type RawTerm } from "./terms";
import { compareSortKeys, page, titleSortKey } from "./text";

/**
 * The redaction rules, applied as the backend applies them (the spec's
 * operation descriptions, BE PLAN §4.1 and the API docs' "Notes for FE2").
 * Every body the catalogue operations serve is built here or from what is
 * exported here, never from a raw record directly:
 * - a term that is unapproved, or under an unapproved ancestor, is not
 *   public: it is never listed, matched, counted or referred to;
 * - a person who prefers no page is listed as a stub with `profile: null`,
 *   and is dropped from credits (the whole credit), performer lists,
 *   relations, member lists, every `person_count`, citations and
 *   needs-work;
 * - hidden aliases and hidden links never appear, nor do the performances
 *   a hidden link records;
 * - only approved revisions are served, and their snapshots are redacted by
 *   what is visible now, with `changed_fields` computed on the redacted
 *   views.
 *
 * All the fixture's pieces, persons, collections and events are approved;
 * terms and revisions have unapproved records.
 */

type Schemas = components["schemas"];
type Facet = Schemas["Facet"];

/** The facets in the enum's order. */
const FACETS: readonly Facet[] = [
  "mood",
  "topic",
  "culture",
  "language",
  "legendaria",
  "form",
  "origin",
  "other",
  "affiliation",
];

const facetIndex = (facet: Facet) => FACETS.indexOf(facet);

/** Orders a list by an enum's order. */
function enumOrder<T extends string>(order: readonly T[]) {
  return (a: T, b: T) => order.indexOf(a) - order.indexOf(b);
}

/** Records by key, with their position for stable tie-breaks. */
function indexed<T, K>(records: readonly T[], key: (record: T) => K) {
  return new Map(
    records.map((record, index) => [key(record), { record, index }])
  );
}

const TERM_INDEX = indexed(TERMS, t => t.slug);
const PIECE_INDEX = indexed(PIECES, p => p.slug);
const PERSON_INDEX = indexed(PERSONS, p => p.slug);
const COLLECTION_INDEX = indexed(COLLECTIONS, c => c.id);
const EVENT_INDEX = indexed(EVENTS, e => e.slug);

// Terms ---------------------------------------------------------------------

function isPublicTerm(slug: string): boolean {
  const term = TERM_INDEX.get(slug)?.record;
  if (!term?.approved) return false;
  return term.parent === null || isPublicTerm(term.parent);
}

/** The public term with this slug, if there is one. */
export function publicTerm(slug: string): RawTerm | undefined {
  return isPublicTerm(slug) ? TERM_INDEX.get(slug)?.record : undefined;
}

/** The parser's term lookup: the facet of a public term. */
export const publicTermFacet: TermFacet = slug => publicTerm(slug)?.facet;

const publicTermSummary = (slug: string | null) =>
  slug !== null && isPublicTerm(slug) ? termSummary(slug) : null;

function compareSiblings(a: RawTerm, b: RawTerm): number {
  return (
    a.position - b.position ||
    compareSortKeys(a.display_name, b.display_name) ||
    compareSortKeys(a.slug, b.slug)
  );
}

function publicChildren(slug: string | null): RawTerm[] {
  return TERMS.filter(t => t.parent === slug && isPublicTerm(t.slug)).sort(
    compareSiblings
  );
}

/** The public terms in tree order: facets in the enum's order, parents first. */
export const PUBLIC_TERMS: readonly RawTerm[] = FACETS.flatMap(facet => {
  const walk = (term: RawTerm): RawTerm[] => [
    term,
    ...publicChildren(term.slug).flatMap(walk),
  ];
  return publicChildren(null)
    .filter(t => t.facet === facet)
    .flatMap(walk);
});

/** A public term's ancestors, root first. */
function ancestorsOf(term: RawTerm): RawTerm[] {
  const parent =
    term.parent === null ? undefined : TERM_INDEX.get(term.parent)?.record;
  return parent ? [...ancestorsOf(parent), parent] : [];
}

/** The public terms a piece is tagged with, and all their ancestors. */
function pieceTermClosure(piece: RawPiece): ReadonlySet<string> {
  return new Set(
    piece.terms.flatMap(({ term }) => {
      const found = publicTerm(term);
      return found ? [term, ...ancestorsOf(found).map(t => t.slug)] : [];
    })
  );
}

const PIECE_CLOSURES: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  PIECES.map(p => [p.slug, pieceTermClosure(p)])
);

/** Whether a piece is tagged with the term or one of its public descendants. */
export function pieceHasTerm(piece: RawPiece, slug: string): boolean {
  return PIECE_CLOSURES.get(piece.slug)?.has(slug) ?? false;
}

/** The public terms of a piece and their ancestors: what it counts under. */
export function pieceTermsCounted(piece: RawPiece): ReadonlySet<string> {
  return PIECE_CLOSURES.get(piece.slug) ?? new Set();
}

// Persons -------------------------------------------------------------------

/** Whether a person is public and has a page (doesn't prefer not to). */
export function hasPage(slug: string): boolean {
  const person = PERSON_INDEX.get(slug)?.record;
  return person !== undefined && person.status !== "prefers_no_page";
}

/** A person as lists show them: one who prefers no page is a stub. */
export function servePersonSummary(
  person: RawPerson
): Schemas["PersonSummary"] {
  return {
    ...personSummary(person.slug),
    is_stub: person.is_stub || !hasPage(person.slug),
  };
}

/** Whether a person with a page is affiliated with the term or a public descendant. */
export function personHasAffiliation(person: RawPerson, slug: string): boolean {
  if (!hasPage(person.slug)) return false;
  return (person.profile?.affiliations ?? []).some(affiliation => {
    const term = publicTerm(affiliation);
    return (
      term !== undefined &&
      (term.slug === slug || ancestorsOf(term).some(a => a.slug === slug))
    );
  });
}

/** The person's public alias names, matched by search and shown in snapshots. */
export function publicAliasNames(person: RawPerson): readonly string[] {
  return (person.profile?.aliases ?? [])
    .filter(alias => !alias.hidden)
    .map(alias => alias.name);
}

const publicPersonSummary = (slug: string) =>
  hasPage(slug) ? personSummary(slug) : null;

const performers = (slugs: readonly string[]) =>
  slugs.flatMap(slug => publicPersonSummary(slug) ?? []);

// Sorting -------------------------------------------------------------------

export function comparePieces(a: RawPiece, b: RawPiece): number {
  return (
    compareSortKeys(titleSortKey(a.title), titleSortKey(b.title)) ||
    (PIECE_INDEX.get(a.slug)?.index ?? 0) -
      (PIECE_INDEX.get(b.slug)?.index ?? 0)
  );
}

/** Persons sort by name as written (BE PLAN §4.1): no leading The, A or An is skipped. */
export function comparePersons(a: RawPerson, b: RawPerson): number {
  return (
    compareSortKeys(a.name, b.name) ||
    (PERSON_INDEX.get(a.slug)?.index ?? 0) -
      (PERSON_INDEX.get(b.slug)?.index ?? 0)
  );
}

export function compareCollections(a: RawCollection, b: RawCollection): number {
  return (
    compareSortKeys(titleSortKey(a.name), titleSortKey(b.name)) || a.id - b.id
  );
}

// Links and performances ----------------------------------------------------

/** Whether a link's owner is public: a piece, or a person with a page. */
function ownerIsPublic(link: RawLink): boolean {
  return link.owner.kind === "piece"
    ? PIECE_INDEX.has(link.owner.slug)
    : hasPage(link.owner.slug);
}

/** The links any read may show: not hidden, attached to a public owner. */
export const VISIBLE_LINKS: readonly RawLink[] = LINKS.filter(
  link => !link.hidden && ownerIsPublic(link)
);

const linksOf = (kind: "piece" | "person", slug: string) =>
  VISIBLE_LINKS.filter(l => l.owner.kind === kind && l.owner.slug === slug);

const publicCollectionRef = (id: number | null) =>
  id !== null && COLLECTION_INDEX.has(id) ? collectionRef(id) : null;

const publicEventSummary = (slug: string | null) =>
  slug !== null && EVENT_INDEX.has(slug) ? eventSummary(slug) : null;

function servePerformance(raw: RawPerformance): Schemas["PiecePerformance"] {
  return {
    year: raw.year,
    uploader: raw.uploader,
    description_verbatim: raw.description_verbatim,
    event: publicEventSummary(raw.event),
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
    collection: publicCollectionRef(link.collection),
    locator: link.locator,
    liveness: link.liveness,
    last_checked_at: link.last_checked_at,
    archived_url: link.archived_url,
    roles: [...link.roles],
  };
}

function performanceLink(link: RawLink): Schemas["PerformanceLink"] {
  return { url: link.url, title: link.title, platform: link.platform };
}

/** A performance on a visible link, with the link and the piece it is of. */
type LinkedPerformance = {
  readonly link: RawLink;
  readonly performance: RawPerformance;
  /** The order recorded, for stable ties. */
  readonly order: number;
};

const LINKED_PERFORMANCES: readonly LinkedPerformance[] = VISIBLE_LINKS.flatMap(
  link => link.performances.map(performance => ({ link, performance }))
).map((linked, order) => ({ ...linked, order }));

/** Newest year first, unknown years last. */
function newestFirst(a: LinkedPerformance, b: LinkedPerformance): number {
  const ay = a.performance.year;
  const by = b.performance.year;
  if (ay !== by) {
    if (ay === null) return 1;
    if (by === null) return -1;
    return by - ay;
  }
  return a.order - b.order;
}

const performedPiece = (link: RawLink) =>
  link.owner.kind === "piece" ? pieceSummary(link.owner.slug) : null;

/** The cap on works, performances and citations. */
const CAP = 200;

// Pieces --------------------------------------------------------------------

/** A public piece by slug. */
export function publicPiece(slug: string): RawPiece | undefined {
  return PIECE_INDEX.get(slug)?.record;
}

const RELATION_TYPES: readonly Schemas["PieceRelationType"][] = [
  "variant_of",
  "contrafactum_of",
  "setting_of",
  "same_text_other_form",
];

function pieceRelations(slug: string): Schemas["PieceRelation"][] {
  const byTypeAndTitle = (
    a: Schemas["PieceRelation"],
    b: Schemas["PieceRelation"]
  ) =>
    enumOrder(RELATION_TYPES)(a.type, b.type) ||
    comparePieces(rawPiece(a.piece.slug), rawPiece(b.piece.slug));
  const outgoing = PIECE_RELATIONS.filter(
    r => r.from === slug && PIECE_INDEX.has(r.to)
  ).map(r => ({
    type: r.type,
    direction: "outgoing" as const,
    piece: pieceSummary(r.to),
  }));
  const incoming = PIECE_RELATIONS.filter(
    r => r.to === slug && PIECE_INDEX.has(r.from)
  ).map(r => ({
    type: r.type,
    direction: "incoming" as const,
    piece: pieceSummary(r.from),
  }));
  return [...outgoing.sort(byTypeAndTitle), ...incoming.sort(byTypeAndTitle)];
}

export function servePiece(raw: RawPiece): Schemas["Piece"] {
  return {
    ...pieceSummary(raw.slug),
    notes_md: raw.notes_md,
    version_notes_md: raw.version_notes_md,
    licensing_status: raw.licensing_status,
    licensing_notes_md: raw.licensing_notes_md,
    licence: raw.licence,
    historical_source_md: raw.historical_source_md,
    period_start: raw.period_start,
    period_end: raw.period_end,
    aliases: raw.aliases.map(alias => ({ ...alias })),
    terms: raw.terms
      .map((term, position) => ({
        term,
        position,
        found: publicTerm(term.term),
      }))
      .filter(({ found }) => found !== undefined)
      .sort(
        (a, b) =>
          facetIndex(a.found?.facet ?? "other") -
            facetIndex(b.found?.facet ?? "other") || a.position - b.position
      )
      .map(({ term }) => ({
        term: termSummary(term.term),
        is_primary: term.is_primary,
        part: term.part,
      })),
    credits: raw.credits.flatMap((credit): Schemas["PieceCredit"][] => {
      if (credit.person === null) return [{ ...credit, person: null }];
      const person = publicPersonSummary(credit.person);
      return person ? [{ ...credit, person }] : [];
    }),
    relations: pieceRelations(raw.slug),
    links: linksOf("piece", raw.slug).map(link => ({
      ...personLink(link),
      performances: link.performances.map(servePerformance),
    })),
    conservation_history: raw.conservation_history.map(change => ({
      ...change,
    })),
  };
}

// Persons' pages ------------------------------------------------------------

const ROLES: readonly Schemas["PersonRole"][] = [
  "singer",
  "songwriter",
  "musician",
  "instrumentalist",
  "storyteller",
  "poet",
  "jester",
  "dancer",
];

const PERSON_RELATION_TYPES: readonly Schemas["PersonRelationType"][] = [
  "heir_of",
  "member_of",
  "same_as",
];

/** A public person by slug (one who prefers no page included). */
export function publicPerson(slug: string): RawPerson | undefined {
  return PERSON_INDEX.get(slug)?.record;
}

function personRelations(slug: string): Schemas["PersonRelation"][] {
  const byTypeAndName = (
    a: Schemas["PersonRelation"],
    b: Schemas["PersonRelation"]
  ) =>
    enumOrder(PERSON_RELATION_TYPES)(a.type, b.type) ||
    compareSortKeys(a.person.name, b.person.name);
  const edges = (direction: "outgoing" | "incoming") =>
    PERSON_RELATIONS.flatMap(r => {
      const [self, other] =
        direction === "outgoing" ? [r.from, r.to] : [r.to, r.from];
      const person = self === slug ? publicPersonSummary(other) : null;
      return person ? [{ type: r.type, direction, person }] : [];
    }).sort(byTypeAndName);
  return [...edges("outgoing"), ...edges("incoming")];
}

function works(slug: string): Schemas["PersonWork"][] {
  return [...PIECES].sort(comparePieces).flatMap(piece =>
    piece.credits
      .filter(
        credit => credit.person === slug && credit.attribution === "named"
      )
      .map(credit => ({
        piece: pieceSummary(piece.slug),
        role: credit.role,
        certainty: credit.certainty,
        part: credit.part,
      }))
  );
}

function personPerformances(slug: string): Schemas["PersonPerformance"][] {
  return LINKED_PERFORMANCES.filter(
    ({ link, performance }) =>
      performance.performers.includes(slug) ||
      (link.owner.kind === "person" && link.owner.slug === slug)
  )
    .sort(newestFirst)
    .map(({ link, performance }) => ({
      piece: performedPiece(link),
      link: performanceLink(link),
      year: performance.year,
      event: publicEventSummary(performance.event),
      description_verbatim: performance.description_verbatim,
    }));
}

export function servePerson(raw: RawPerson): Schemas["Person"] {
  const identity = {
    ...servePersonSummary(raw),
    status: raw.status,
    status_date: raw.status_date,
    status_source_url: raw.status_source_url,
  };
  const { profile } = raw;
  if (profile === null || !hasPage(raw.slug)) {
    return { ...identity, profile: null };
  }
  const allWorks = works(raw.slug);
  const allPerformances = personPerformances(raw.slug);
  return {
    ...identity,
    profile: {
      pronouns: profile.pronouns,
      notes_md: profile.notes_md,
      licensing_status: profile.licensing_status,
      licensing_notes_md: profile.licensing_notes_md,
      aliases: profile.aliases
        .filter(alias => !alias.hidden)
        .map(({ name, kind }) => ({ name, kind })),
      roles: [...profile.roles].sort(enumOrder(ROLES)),
      affiliations: profile.affiliations
        .flatMap(slug => publicTerm(slug) ?? [])
        .sort(
          (a, b) => a.position - b.position || compareSortKeys(a.name, b.name)
        )
        .map(term => termSummary(term.slug)),
      relations: personRelations(raw.slug),
      links: linksOf("person", raw.slug).map(personLink),
      works: allWorks.slice(0, CAP),
      works_total: allWorks.length,
      performances: allPerformances.slice(0, CAP),
      performances_total: allPerformances.length,
    },
  };
}

// Terms' pages --------------------------------------------------------------

/** The public pieces a term classifies, by sort title. */
function termPieces(slug: string): RawPiece[] {
  return PIECES.filter(p => pieceHasTerm(p, slug)).sort(comparePieces);
}

/** The persons with a page an affiliation term covers, by name. */
function termPersons(slug: string): RawPerson[] {
  return PERSONS.filter(p => personHasAffiliation(p, slug)).sort(
    comparePersons
  );
}

const counts = (slug: string) => ({
  piece_count: termPieces(slug).length,
  person_count: termPersons(slug).length,
});

export function serveTermListItem(term: RawTerm): Schemas["TermListItem"] {
  return {
    slug: term.slug,
    facet: term.facet,
    name: term.name,
    display_name: term.display_name,
    parent_slug: term.parent,
    ...counts(term.slug),
  };
}

export function serveTerm(
  term: RawTerm,
  query: URLSearchParams
): Schemas["Term"] {
  const affiliation = term.facet === "affiliation";
  return {
    slug: term.slug,
    facet: term.facet,
    name: term.name,
    display_name: term.display_name,
    description_md: term.description_md,
    aliases: [...term.aliases],
    ancestors: ancestorsOf(term).map(t => termSummary(t.slug)),
    children: publicChildren(term.slug).map(child => ({
      term: termSummary(child.slug),
      ...counts(child.slug),
    })),
    related_affiliation: publicTermSummary(term.related_affiliation),
    ...counts(term.slug),
    pieces: affiliation
      ? []
      : page(termPieces(term.slug), query).map(p => pieceSummary(p.slug)),
    persons: affiliation
      ? page(termPersons(term.slug), query).map(servePersonSummary)
      : [],
  };
}

// Collections and events ----------------------------------------------------

/** A public collection by id. */
export function publicCollection(id: number): RawCollection | undefined {
  return COLLECTION_INDEX.get(id)?.record;
}

export function serveCollectionSummary(
  raw: RawCollection
): Schemas["CollectionSummary"] {
  return {
    id: raw.id,
    name: raw.name,
    kind: raw.kind,
    url: raw.url,
    is_bardic_resource: raw.is_bardic_resource,
  };
}

/** A collection's visible links, once per public owner, by the owner's sort key. */
function citations(id: number): Schemas["CollectionCitation"][] {
  const ownerKey = (link: RawLink) =>
    link.owner.kind === "piece"
      ? titleSortKey(PIECE_INDEX.get(link.owner.slug)?.record.title ?? "")
      : (PERSON_INDEX.get(link.owner.slug)?.record.name ?? "");
  return VISIBLE_LINKS.filter(link => link.collection === id)
    .sort((a, b) => compareSortKeys(ownerKey(a), ownerKey(b)) || a.id - b.id)
    .map(link => ({
      piece: link.owner.kind === "piece" ? pieceSummary(link.owner.slug) : null,
      person:
        link.owner.kind === "person" ? personSummary(link.owner.slug) : null,
      url: link.url,
      title: link.title,
      locator: link.locator,
      roles: [...link.roles],
    }));
}

export function serveCollection(raw: RawCollection): Schemas["Collection"] {
  const parent = raw.parent === null ? undefined : publicCollection(raw.parent);
  const all = citations(raw.id);
  return {
    ...serveCollectionSummary(raw),
    description_md: raw.description_md,
    enumerable: raw.enumerable,
    region: publicTermSummary(raw.region),
    parent: parent ? serveCollectionSummary(parent) : null,
    children: COLLECTIONS.filter(c => c.parent === raw.id)
      .sort(compareCollections)
      .map(serveCollectionSummary),
    citations: all.slice(0, CAP),
    citations_total: all.length,
  };
}

/** A public event or venue by slug. */
export function publicEvent(slug: string): RawEvent | undefined {
  return EVENT_INDEX.get(slug)?.record;
}

export function serveEvent(raw: RawEvent): Schemas["Event"] {
  const all = LINKED_PERFORMANCES.filter(
    ({ performance }) => performance.event === raw.slug
  )
    .sort(newestFirst)
    .map(({ link, performance }) => ({
      piece: performedPiece(link),
      link: performanceLink(link),
      year: performance.year,
      performers: performers(performance.performers),
      description_verbatim: performance.description_verbatim,
    }));
  return {
    ...eventSummary(raw.slug),
    description_md: raw.description_md,
    performances: all.slice(0, CAP),
    performances_total: all.length,
  };
}

// Revisions -----------------------------------------------------------------

type Revision = Schemas["Revision"];
type EntityType = Revision["entity_type"];

/** The key an entity is addressed by: its slug, or a collection's id. */
function entityKey(revision: Revision): string {
  return revision.entity_type === "collection"
    ? String(revision.entity.id)
    : revision.entity.slug;
}

function entityIsPublic(type: EntityType, key: string): boolean {
  switch (type) {
    case "piece":
      return PIECE_INDEX.has(key);
    case "person":
      return PERSON_INDEX.has(key);
    case "term":
      return isPublicTerm(key);
    case "collection":
      return COLLECTION_INDEX.has(Number(key));
    case "event":
      return EVENT_INDEX.has(key);
  }
}

/** Every stored revision; only approved ones of public entities are served. */
const STORED: readonly { revision: Revision; approved: boolean }[] = [
  ...REVISIONS.map(revision => ({ revision, approved: true })),
  ...UNAPPROVED_REVISIONS.map(revision => ({ revision, approved: false })),
];

function isPublicRevision(revision: Revision, approved: boolean): boolean {
  return approved && entityIsPublic(revision.entity_type, entityKey(revision));
}

/**
 * The approved revisions of a public entity, newest first (by
 * `created_at`, then id); undefined when the entity isn't public.
 */
export function historyOf(
  type: EntityType,
  key: string
): Schemas["RevisionSummary"][] | undefined {
  if (!entityIsPublic(type, key)) return undefined;
  return STORED.filter(
    ({ revision, approved }) =>
      approved && revision.entity_type === type && entityKey(revision) === key
  )
    .map(({ revision }) => revision)
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
    .map(revision => ({
      id: revision.id,
      source: revision.source,
      summary: revision.summary,
      author: revision.author === null ? null : { ...revision.author },
      contributors: [...revision.contributors],
      created_at: revision.created_at,
    }));
}

/** A link a snapshot shows, under its current URL: only if it is visible now. */
function visibleLinkNow(url: string): RawLink | undefined {
  return VISIBLE_LINKS.find(link => link.url === url);
}

function redactPerformance(
  performance: Schemas["PiecePerformance"]
): Schemas["PiecePerformance"] {
  return {
    ...performance,
    event: publicEventSummary(performance.event?.slug ?? null),
    performers: performers(performance.performers.map(p => p.slug)),
  };
}

function redactPieceSnapshot(
  snapshot: Schemas["PieceSnapshot"]
): Schemas["PieceSnapshot"] {
  return {
    ...snapshot,
    terms: snapshot.terms.flatMap(term =>
      isPublicTerm(term.term.slug)
        ? [{ ...term, term: termSummary(term.term.slug) }]
        : []
    ),
    credits: snapshot.credits.flatMap(credit => {
      if (credit.person === null) return [credit];
      const person = publicPersonSummary(credit.person.slug);
      return person ? [{ ...credit, person }] : [];
    }),
    relations: snapshot.relations.flatMap(relation =>
      PIECE_INDEX.has(relation.piece.slug)
        ? [{ ...relation, piece: pieceSummary(relation.piece.slug) }]
        : []
    ),
    links: snapshot.links.flatMap(link => {
      const now = visibleLinkNow(link.url);
      return now
        ? [
            {
              ...link,
              url: now.url,
              collection: publicCollectionRef(link.collection?.id ?? null),
              performances: link.performances.map(redactPerformance),
            },
          ]
        : [];
    }),
  };
}

function redactPersonSnapshot(
  snapshot: Schemas["PersonSnapshot"],
  person: RawPerson
): Schemas["PersonSnapshot"] {
  const aliases = new Set(publicAliasNames(person));
  const name =
    snapshot.name === person.name || aliases.has(snapshot.name)
      ? snapshot.name
      : person.name;
  const { profile } = snapshot;
  const identityOnly =
    profile === null ||
    !hasPage(person.slug) ||
    snapshot.status === "prefers_no_page";
  return {
    ...snapshot,
    name,
    profile: identityOnly
      ? null
      : {
          ...profile,
          aliases: profile.aliases.filter(alias => aliases.has(alias.name)),
          affiliations: profile.affiliations.flatMap(
            term => publicTermSummary(term.slug) ?? []
          ),
          relations: profile.relations.flatMap(relation => {
            const other = publicPersonSummary(relation.person.slug);
            return other ? [{ ...relation, person: other }] : [];
          }),
          links: profile.links.flatMap(link => {
            const now = visibleLinkNow(link.url);
            if (!now) return [];
            return [
              {
                ...link,
                url: now.url,
                collection: publicCollectionRef(link.collection?.id ?? null),
                performances: link.performances.flatMap(performance => {
                  if (
                    performance.piece !== null &&
                    !PIECE_INDEX.has(performance.piece.slug)
                  ) {
                    return [];
                  }
                  return [
                    {
                      ...performance,
                      ...redactPerformance(performance),
                      piece:
                        performance.piece === null
                          ? null
                          : pieceSummary(performance.piece.slug),
                    },
                  ];
                }),
              },
            ];
          }),
        },
  };
}

function redactTermSnapshot(
  snapshot: Schemas["TermSnapshot"]
): Schemas["TermSnapshot"] {
  return {
    ...snapshot,
    parent: publicTermSummary(snapshot.parent?.slug ?? null),
    related_affiliation: publicTermSummary(
      snapshot.related_affiliation?.slug ?? null
    ),
  };
}

function redactCollectionSnapshot(
  snapshot: Schemas["CollectionSnapshot"]
): Schemas["CollectionSnapshot"] {
  const parent =
    snapshot.parent === null ? undefined : publicCollection(snapshot.parent.id);
  return {
    ...snapshot,
    region: publicTermSummary(snapshot.region?.slug ?? null),
    parent: parent ? serveCollectionSummary(parent) : null,
  };
}

/**
 * Pairs a redacted snapshot with its redacted base (null, with a null id,
 * when there is none) and the diff of the two views.
 */
function view<S extends object>(
  snapshot: S,
  base: S | null,
  baseId: number | null
) {
  return {
    base_revision_id: base === null ? null : baseId,
    snapshot,
    base_snapshot: base,
    changed_fields: changedFields<keyof S & string>(
      snapshot as Readonly<Record<keyof S & string, unknown>>,
      base as Readonly<Record<keyof S & string, unknown>> | null
    ),
  };
}

/**
 * A public revision, redacted by what is visible now; undefined when it
 * isn't public (not approved, unknown, or of an entity that isn't public).
 * The base is shown only if it is an approved revision of the same entity.
 */
export function serveRevision(id: number): Revision | undefined {
  const stored = STORED.find(({ revision }) => revision.id === id);
  if (!stored || !isPublicRevision(stored.revision, stored.approved)) {
    return undefined;
  }
  const revision = stored.revision;
  const baseStored = STORED.find(
    ({ revision: candidate, approved }) =>
      approved &&
      candidate.id === revision.base_revision_id &&
      candidate.entity_type === revision.entity_type &&
      entityKey(candidate) === entityKey(revision)
  )?.revision;
  const meta = {
    id: revision.id,
    source: revision.source,
    summary: revision.summary,
    author: revision.author === null ? null : { ...revision.author },
    contributors: [...revision.contributors],
    created_at: revision.created_at,
  };
  switch (revision.entity_type) {
    case "piece": {
      return {
        entity_type: "piece",
        entity: pieceSummary(revision.entity.slug),
        ...meta,
        ...view(
          redactPieceSnapshot(revision.snapshot),
          baseStored?.entity_type === "piece"
            ? redactPieceSnapshot(baseStored.snapshot)
            : null,
          revision.base_revision_id
        ),
      };
    }
    case "person": {
      const person = rawPerson(revision.entity.slug);
      return {
        entity_type: "person",
        entity: servePersonSummary(person),
        ...meta,
        ...view(
          redactPersonSnapshot(revision.snapshot, person),
          baseStored?.entity_type === "person"
            ? redactPersonSnapshot(baseStored.snapshot, person)
            : null,
          revision.base_revision_id
        ),
      };
    }
    case "term":
      return {
        entity_type: "term",
        entity: termSummary(revision.entity.slug),
        ...meta,
        ...view(
          redactTermSnapshot(revision.snapshot),
          baseStored?.entity_type === "term"
            ? redactTermSnapshot(baseStored.snapshot)
            : null,
          revision.base_revision_id
        ),
      };
    case "collection":
      return {
        entity_type: "collection",
        entity: collectionRef(revision.entity.id),
        ...meta,
        ...view(
          redactCollectionSnapshot(revision.snapshot),
          baseStored?.entity_type === "collection"
            ? redactCollectionSnapshot(baseStored.snapshot)
            : null,
          revision.base_revision_id
        ),
      };
    case "event":
      return {
        entity_type: "event",
        entity: eventSummary(revision.entity.slug),
        ...meta,
        ...view(
          { ...revision.snapshot },
          baseStored?.entity_type === "event"
            ? { ...baseStored.snapshot }
            : null,
          revision.base_revision_id
        ),
      };
  }
}
