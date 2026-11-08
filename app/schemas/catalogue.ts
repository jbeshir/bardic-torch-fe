import { z } from "zod";
import type { components, operations } from "~/api/schema.gen";
import {
  COLLECTION_KINDS,
  CONSERVATION_STATUS_VALUES,
  CREDIT_ROLES,
  EVENT_KINDS,
  FACETS,
  LETTERS,
  LINK_ROLES,
  PERSON_KINDS,
  PERSON_ROLES,
  PERSON_SORTS,
  PIECE_KINDS,
  PIECE_SORTS,
} from "~/constants/enums";
import type { Assert, DeepReadonly, Matches } from "./contract";

/**
 * Runtime schemas for the catalogue's response bodies, each checked at
 * compile time against the generated spec types in both directions. The
 * spec's objects are closed, so every object here is strict: a field the
 * spec doesn't declare is a contract break (502), not data to pass on.
 *
 * The enum values are `app/constants/enums.ts`'s, in the spec's order: code
 * the browser loads reads them there, never `schema.options`, so zod and
 * these schemas stay out of the client bundle.
 * Schemas are added with the first loader that parses them.
 */

type Schemas = components["schemas"];

const pieceKindSchema = z.enum(PIECE_KINDS);

const conservationStatusSchema = z.enum(CONSERVATION_STATUS_VALUES);

const letterSchema = z.enum(LETTERS);

/** A count the API lists: only values with at least one match appear. */
const countSchema = z.int().min(1);

/** How many entries of a list sort under a letter (`LetterCount`). */
const letterCountSchema = z.strictObject({
  letter: letterSchema,
  count: countSchema,
});

const pieceSummarySchema = z.strictObject({
  slug: z.string(),
  title: z.string(),
  kind: pieceKindSchema,
  secondary_kinds: z.array(pieceKindSchema),
  conservation_status: conservationStatusSchema,
  is_stub: z.boolean(),
});

const pieceFacetsSchema = z.strictObject({
  terms: z.array(z.strictObject({ slug: z.string(), count: countSchema })),
  kinds: z.array(z.strictObject({ kind: pieceKindSchema, count: countSchema })),
  conservation_statuses: z.array(
    z.strictObject({
      conservation_status: conservationStatusSchema,
      count: countSchema,
    })
  ),
  letters: z.array(letterCountSchema),
});

export const pieceListSchema = z.strictObject({
  data: z.array(pieceSummarySchema),
  total: z.int().min(0),
  facets: pieceFacetsSchema,
});

// ---------------------------------------------------------------------------
// Terms: the facet column's labels and tree, and /categories

const facetSchema = z.enum(FACETS);

/** A term's member count: 0 for a term nothing is classified under yet. */
const memberCountSchema = z.int().min(0);

const termListItemSchema = z.strictObject({
  slug: z.string(),
  facet: facetSchema,
  name: z.string(),
  display_name: z.string(),
  parent_slug: z.string().nullable(),
  piece_count: memberCountSchema,
  person_count: memberCountSchema,
});

export const termListSchema = z.strictObject({
  data: z.array(termListItemSchema),
});

// ---------------------------------------------------------------------------
// Persons: the search page's bards, the bards directory and every
// list that names a person

const personKindSchema = z.enum(PERSON_KINDS);

const personSummarySchema = z.strictObject({
  slug: z.string(),
  name: z.string(),
  kind: personKindSchema,
  is_stub: z.boolean(),
});

export const personListSchema = z.strictObject({
  data: z.array(personSummarySchema),
  total: z.int().min(0),
  letters: z.array(letterCountSchema),
});

// ---------------------------------------------------------------------------
// Shared by the entity bodies and their revision snapshots: the enums and
// the small nested objects.
// ---------------------------------------------------------------------------

const eventKindSchema = z.enum(EVENT_KINDS);

const licensingStatusSchema = z.enum(["known", "unknown"]);

const licenceSchema = z.enum([
  "pd",
  "cc_by",
  "cc_by_sa",
  "cc_by_nc",
  "cc_by_nc_sa",
  "cc_by_nd",
  "cc_by_nc_nd",
  "arr",
  "other",
]);

const pieceAliasKindSchema = z.enum([
  "alt_title",
  "nickname",
  "subtitle",
  "redirect",
]);

const personAliasKindSchema = z.enum([
  "legal",
  "sca",
  "stage",
  "nickname",
  "former",
  "redirect",
]);

const piecePartSchema = z.enum(["words", "tune", "verses", "chorus"]);

/** The credit roles, in the order a person's works are grouped by. */
const creditRoleSchema = z.enum(CREDIT_ROLES);

const attributionSchema = z.enum([
  "named",
  "traditional",
  "unknown",
  "anonymous",
  "various",
]);

const certaintySchema = z.enum(["certain", "probable", "possible", "disputed"]);

const pieceRelationTypeSchema = z.enum([
  "variant_of",
  "contrafactum_of",
  "setting_of",
  "same_text_other_form",
]);

const personRelationTypeSchema = z.enum(["heir_of", "member_of", "same_as"]);

const relationDirectionSchema = z.enum(["outgoing", "incoming"]);

const personStatusSchema = z.enum(["active", "deceased", "prefers_no_page"]);

const personRoleSchema = z.enum(PERSON_ROLES);

const linkPlaceTypeSchema = z.enum([
  "recording_platform",
  "streaming",
  "author_site",
  "community_archive",
  "physical_archive",
  "book",
  "vendor",
  "author_contact",
  "oral_tradition",
  "other",
]);

const livenessSchema = z.enum(["unknown", "ok", "dead", "blocked"]);

/** The link roles, in the order a page groups links by (the spec's). */
const linkRoleSchema = z.enum(LINK_ROLES);

const termSummarySchema = z.strictObject({
  slug: z.string(),
  facet: facetSchema,
  display_name: z.string(),
});

const collectionRefSchema = z.strictObject({
  id: z.int().min(1),
  name: z.string(),
});

const eventSummarySchema = z.strictObject({
  slug: z.string(),
  name: z.string(),
  kind: eventKindSchema,
});

const pieceAliasSchema = z.strictObject({
  text: z.string(),
  kind: pieceAliasKindSchema,
});

const personAliasSchema = z.strictObject({
  name: z.string(),
  kind: personAliasKindSchema,
});

const pieceTermSchema = z.strictObject({
  term: termSummarySchema,
  is_primary: z.boolean(),
  part: piecePartSchema.nullable(),
});

/**
 * A credit names a person exactly when its attribution is `named` (the API
 * docs); a credit that breaks that is a contract break, not a credit to
 * show as "unknown".
 */
const pieceCreditSchema = z
  .strictObject({
    role: creditRoleSchema,
    attribution: attributionSchema,
    certainty: certaintySchema,
    part: piecePartSchema.nullable(),
    note: z.string().nullable(),
    person: personSummarySchema.nullable(),
  })
  .refine(
    credit => (credit.attribution === "named") === (credit.person !== null),
    { message: "a credit names a person exactly when it is named" }
  );

const piecePerformanceSchema = z.strictObject({
  year: z.int().nullable(),
  uploader: z.string().nullable(),
  description_verbatim: z.string(),
  event: eventSummarySchema.nullable(),
  performers: z.array(personSummarySchema),
});

/** A performance's recording, as an event or a person lists it. */
const performanceLinkSchema = z.strictObject({
  url: z.string(),
  title: z.string().nullable(),
  platform: z.string().nullable(),
});

/** What every link has, a piece's or a person's, live or in a snapshot. */
const snapshotLinkFields = {
  url: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  platform: z.string().nullable(),
  place_type: linkPlaceTypeSchema.nullable(),
  collection: collectionRefSchema.nullable(),
  locator: z.string().nullable(),
  roles: z.array(linkRoleSchema),
};

/** A live link: a snapshot's fields plus its liveness and archive copy. */
const linkFields = {
  ...snapshotLinkFields,
  liveness: livenessSchema,
  last_checked_at: z.string().nullable(),
  archived_url: z.string().nullable(),
};

// ---------------------------------------------------------------------------
// The piece page: `getPiece`'s body.
// ---------------------------------------------------------------------------

const pieceLinkSchema = z.strictObject({
  ...linkFields,
  performances: z.array(piecePerformanceSchema),
});

export const pieceSchema = z.strictObject({
  slug: z.string(),
  title: z.string(),
  kind: pieceKindSchema,
  secondary_kinds: z.array(pieceKindSchema),
  conservation_status: conservationStatusSchema,
  is_stub: z.boolean(),
  notes_md: z.string().nullable(),
  version_notes_md: z.string().nullable(),
  licensing_status: licensingStatusSchema,
  licensing_notes_md: z.string().nullable(),
  licence: licenceSchema.nullable(),
  historical_source_md: z.string().nullable(),
  period_start: z.int().nullable(),
  period_end: z.int().nullable(),
  aliases: z.array(pieceAliasSchema),
  terms: z.array(pieceTermSchema),
  credits: z.array(pieceCreditSchema),
  relations: z.array(
    z.strictObject({
      type: pieceRelationTypeSchema,
      direction: relationDirectionSchema,
      piece: pieceSummarySchema,
    })
  ),
  links: z.array(pieceLinkSchema),
  conservation_history: z.array(
    z.strictObject({
      conservation_status: conservationStatusSchema,
      reason: z.string(),
      source_url: z.string().nullable(),
      at: z.string(),
    })
  ),
});

// ---------------------------------------------------------------------------
// The bard page: `getPerson`'s body.
// ---------------------------------------------------------------------------

const personLinkSchema = z.strictObject(linkFields);

const personProfileSchema = z.strictObject({
  pronouns: z.string().nullable(),
  notes_md: z.string().nullable(),
  licensing_status: licensingStatusSchema,
  licensing_notes_md: z.string().nullable(),
  aliases: z.array(personAliasSchema),
  roles: z.array(personRoleSchema),
  affiliations: z.array(termSummarySchema),
  relations: z.array(
    z.strictObject({
      type: personRelationTypeSchema,
      direction: relationDirectionSchema,
      person: personSummarySchema,
    })
  ),
  links: z.array(personLinkSchema),
  works: z
    .array(
      z.strictObject({
        piece: pieceSummarySchema,
        role: creditRoleSchema,
        certainty: certaintySchema,
        part: piecePartSchema.nullable(),
      })
    )
    .max(200),
  works_total: z.int().min(0),
  performances: z
    .array(
      z.strictObject({
        piece: pieceSummarySchema.nullable(),
        link: performanceLinkSchema,
        year: z.int().nullable(),
        event: eventSummarySchema.nullable(),
        description_verbatim: z.string(),
      })
    )
    .max(200),
  performances_total: z.int().min(0),
});

/**
 * A person has no profile exactly when they prefer not to have a page (the
 * spec); a body that breaks that is a contract break.
 */
export const personSchema = z
  .strictObject({
    slug: z.string(),
    name: z.string(),
    kind: personKindSchema,
    is_stub: z.boolean(),
    status: personStatusSchema,
    status_date: z.string().nullable(),
    status_source_url: z.string().nullable(),
    profile: personProfileSchema.nullable(),
  })
  .refine(
    person =>
      (person.status === "prefers_no_page") === (person.profile === null),
    { message: "a person has no profile exactly when they prefer no page" }
  );

// ---------------------------------------------------------------------------
// A category: `getTerm`'s body

const termChildSchema = z.strictObject({
  term: termSummarySchema,
  piece_count: memberCountSchema,
  person_count: memberCountSchema,
});

export const termSchema = z.strictObject({
  slug: z.string(),
  facet: facetSchema,
  name: z.string(),
  display_name: z.string(),
  description_md: z.string().nullable(),
  aliases: z.array(z.string()),
  ancestors: z.array(termSummarySchema),
  children: z.array(termChildSchema),
  related_affiliation: termSummarySchema.nullable(),
  piece_count: memberCountSchema,
  person_count: memberCountSchema,
  pieces: z.array(pieceSummarySchema),
  persons: z.array(personSummarySchema),
});

// ---------------------------------------------------------------------------
// Collections (/collections)

const collectionKindSchema = z.enum(COLLECTION_KINDS);

const collectionEnumerableSchema = z.enum([
  "unknown",
  "yes",
  "pdf",
  "browser",
  "api",
  "no",
]);

const collectionSummarySchema = z.strictObject({
  id: z.int().min(1),
  name: z.string(),
  kind: collectionKindSchema,
  url: z.string().nullable(),
  is_bardic_resource: z.boolean(),
});

export const collectionListSchema = z.strictObject({
  data: z.array(collectionSummarySchema),
  total: z.int().min(0),
  letters: z.array(letterCountSchema),
});

const collectionCitationSchema = z.strictObject({
  piece: pieceSummarySchema.nullable(),
  person: personSummarySchema.nullable(),
  url: z.string(),
  title: z.string().nullable(),
  locator: z.string().nullable(),
  roles: z.array(linkRoleSchema),
});

export const collectionSchema = z.strictObject({
  id: z.int().min(1),
  name: z.string(),
  kind: collectionKindSchema,
  url: z.string().nullable(),
  is_bardic_resource: z.boolean(),
  description_md: z.string().nullable(),
  enumerable: collectionEnumerableSchema,
  region: termSummarySchema.nullable(),
  parent: collectionSummarySchema.nullable(),
  children: z.array(collectionSummarySchema),
  citations: z.array(collectionCitationSchema),
  citations_total: z.int().min(0),
});

// ---------------------------------------------------------------------------
// Events (/events)

export const eventListSchema = z.strictObject({
  data: z.array(eventSummarySchema),
  total: z.int().min(0),
});

const eventPerformanceSchema = z.strictObject({
  piece: pieceSummarySchema.nullable(),
  link: performanceLinkSchema,
  year: z.int().nullable(),
  performers: z.array(personSummarySchema),
  description_verbatim: z.string(),
});

export const eventSchema = z.strictObject({
  slug: z.string(),
  name: z.string(),
  kind: eventKindSchema,
  description_md: z.string().nullable(),
  performances: z.array(eventPerformanceSchema),
  performances_total: z.int().min(0),
});
// ---------------------------------------------------------------------------
// Histories (*/history)

const revisionSourceSchema = z.enum(["user", "import", "mcp"]);

const revisionAuthorSchema = z.strictObject({ display_name: z.string() });

const revisionSummarySchema = z.strictObject({
  id: z.int().min(1),
  source: revisionSourceSchema,
  summary: z.string(),
  author: revisionAuthorSchema.nullable(),
  contributors: z.array(z.string()),
  created_at: z.string(),
});

export const revisionHistorySchema = z.strictObject({
  data: z.array(revisionSummarySchema),
  total: z.int().min(0),
});

// ---------------------------------------------------------------------------
// Revisions (track C: /revisions/:id)
// Revisions (/revisions/:id). A snapshot is the entity as it was saved:
// its links have no liveness or archive copy, and its relations no direction.

const snapshotPieceLinkSchema = z.strictObject({
  ...snapshotLinkFields,
  performances: z.array(piecePerformanceSchema),
});

const snapshotPersonPerformanceSchema = z.strictObject({
  piece: pieceSummarySchema.nullable(),
  year: z.int().nullable(),
  uploader: z.string().nullable(),
  description_verbatim: z.string(),
  event: eventSummarySchema.nullable(),
  performers: z.array(personSummarySchema),
});

const snapshotPersonLinkSchema = z.strictObject({
  ...snapshotLinkFields,
  performances: z.array(snapshotPersonPerformanceSchema),
});

const pieceSnapshotSchema = z.strictObject({
  title: z.string(),
  kind: pieceKindSchema,
  secondary_kinds: z.array(pieceKindSchema),
  conservation_status: conservationStatusSchema,
  conservation_source_url: z.string().nullable(),
  is_stub: z.boolean(),
  notes_md: z.string().nullable(),
  version_notes_md: z.string().nullable(),
  licensing_status: licensingStatusSchema,
  licensing_notes_md: z.string().nullable(),
  licence: licenceSchema.nullable(),
  historical_source_md: z.string().nullable(),
  period_start: z.int().nullable(),
  period_end: z.int().nullable(),
  aliases: z.array(pieceAliasSchema),
  terms: z.array(pieceTermSchema),
  credits: z.array(pieceCreditSchema),
  relations: z.array(
    z.strictObject({ type: pieceRelationTypeSchema, piece: pieceSummarySchema })
  ),
  links: z.array(snapshotPieceLinkSchema),
});

const personSnapshotProfileSchema = z.strictObject({
  pronouns: z.string().nullable(),
  notes_md: z.string().nullable(),
  licensing_status: licensingStatusSchema,
  licensing_notes_md: z.string().nullable(),
  aliases: z.array(personAliasSchema),
  roles: z.array(personRoleSchema),
  affiliations: z.array(termSummarySchema),
  relations: z.array(
    z.strictObject({
      type: personRelationTypeSchema,
      person: personSummarySchema,
    })
  ),
  links: z.array(snapshotPersonLinkSchema),
});

const personSnapshotSchema = z.strictObject({
  name: z.string(),
  kind: personKindSchema,
  status: personStatusSchema,
  status_date: z.string().nullable(),
  status_source_url: z.string().nullable(),
  is_stub: z.boolean(),
  profile: personSnapshotProfileSchema.nullable(),
});

const termSnapshotSchema = z.strictObject({
  facet: facetSchema,
  name: z.string(),
  display_name: z.string(),
  parent: termSummarySchema.nullable(),
  related_affiliation: termSummarySchema.nullable(),
  description_md: z.string().nullable(),
  position: z.int(),
  aliases: z.array(z.string()),
});

const collectionSnapshotSchema = z.strictObject({
  name: z.string(),
  url: z.string().nullable(),
  kind: collectionKindSchema,
  description_md: z.string().nullable(),
  region: termSummarySchema.nullable(),
  parent: collectionSummarySchema.nullable(),
  is_bardic_resource: z.boolean(),
  enumerable: collectionEnumerableSchema,
});

const eventSnapshotSchema = z.strictObject({
  name: z.string(),
  kind: eventKindSchema,
  description_md: z.string().nullable(),
});

/** What every revision has, whatever its entity. */
const revisionFields = {
  id: z.int().min(1),
  base_revision_id: z.int().min(1).nullable(),
  source: revisionSourceSchema,
  summary: z.string(),
  author: revisionAuthorSchema.nullable(),
  contributors: z.array(z.string()),
  created_at: z.string(),
};

/** The changed fields of a snapshot shape: its keys. */
function fieldsOf<Shape extends z.core.$ZodShape>(schema: z.ZodObject<Shape>) {
  return z.array(schema.keyof());
}

const pieceRevisionSchema = z.strictObject({
  entity_type: z.literal("piece"),
  entity: pieceSummarySchema,
  ...revisionFields,
  snapshot: pieceSnapshotSchema,
  base_snapshot: pieceSnapshotSchema.nullable(),
  changed_fields: fieldsOf(pieceSnapshotSchema),
});

const personRevisionSchema = z.strictObject({
  entity_type: z.literal("person"),
  entity: personSummarySchema,
  ...revisionFields,
  snapshot: personSnapshotSchema,
  base_snapshot: personSnapshotSchema.nullable(),
  changed_fields: fieldsOf(personSnapshotSchema),
});

const termRevisionSchema = z.strictObject({
  entity_type: z.literal("term"),
  entity: termSummarySchema,
  ...revisionFields,
  snapshot: termSnapshotSchema,
  base_snapshot: termSnapshotSchema.nullable(),
  changed_fields: fieldsOf(termSnapshotSchema),
});

const collectionRevisionSchema = z.strictObject({
  entity_type: z.literal("collection"),
  entity: collectionRefSchema,
  ...revisionFields,
  snapshot: collectionSnapshotSchema,
  base_snapshot: collectionSnapshotSchema.nullable(),
  changed_fields: fieldsOf(collectionSnapshotSchema),
});

const eventRevisionSchema = z.strictObject({
  entity_type: z.literal("event"),
  entity: eventSummarySchema,
  ...revisionFields,
  snapshot: eventSnapshotSchema,
  base_snapshot: eventSnapshotSchema.nullable(),
  changed_fields: fieldsOf(eventSnapshotSchema),
});

export const revisionSchema = z.discriminatedUnion("entity_type", [
  pieceRevisionSchema,
  personRevisionSchema,
  termRevisionSchema,
  collectionRevisionSchema,
  eventRevisionSchema,
]);

// ---------------------------------------------------------------------------

/** An operation's query object, as the generated types have it. */
export type ApiQuery<Id extends keyof operations> = DeepReadonly<
  NonNullable<operations[Id]["parameters"]["query"]>
>;

export type ConservationStatus = z.output<typeof conservationStatusSchema>;
export type Letter = z.output<typeof letterSchema>;
export type PieceKind = z.output<typeof pieceKindSchema>;
/** Only a query parameter, never in a body: no schema, just its values. */
export type PieceSort = (typeof PIECE_SORTS)[number];
export type PieceSummary = DeepReadonly<z.output<typeof pieceSummarySchema>>;
export type PieceList = DeepReadonly<z.output<typeof pieceListSchema>>;
export type PieceFacets = PieceList["facets"];
export type Facet = z.output<typeof facetSchema>;
export type TermListItem = DeepReadonly<z.output<typeof termListItemSchema>>;
export type TermList = DeepReadonly<z.output<typeof termListSchema>>;
export type PersonKind = z.output<typeof personKindSchema>;
export type PersonSummary = DeepReadonly<z.output<typeof personSummarySchema>>;
export type PersonList = DeepReadonly<z.output<typeof personListSchema>>;
export type EventKind = z.output<typeof eventKindSchema>;
export type Licence = z.output<typeof licenceSchema>;
export type LicensingStatus = z.output<typeof licensingStatusSchema>;
export type PieceAliasKind = z.output<typeof pieceAliasKindSchema>;
export type PersonAliasKind = z.output<typeof personAliasKindSchema>;
export type PiecePart = z.output<typeof piecePartSchema>;
export type CreditRole = z.output<typeof creditRoleSchema>;
export type Attribution = z.output<typeof attributionSchema>;
export type Certainty = z.output<typeof certaintySchema>;
export type PieceRelationType = z.output<typeof pieceRelationTypeSchema>;
export type PersonRelationType = z.output<typeof personRelationTypeSchema>;
export type RelationDirection = z.output<typeof relationDirectionSchema>;
export type PersonStatus = z.output<typeof personStatusSchema>;
export type PersonRole = z.output<typeof personRoleSchema>;
export type LinkPlaceType = z.output<typeof linkPlaceTypeSchema>;
export type LinkRole = z.output<typeof linkRoleSchema>;
export type TermSummary = DeepReadonly<z.output<typeof termSummarySchema>>;
export type Piece = DeepReadonly<z.output<typeof pieceSchema>>;
export type Person = DeepReadonly<z.output<typeof personSchema>>;
/** Only a query parameter, never in a body: no schema, just its values. */
export type PersonSort = (typeof PERSON_SORTS)[number];
export type Term = DeepReadonly<z.output<typeof termSchema>>;
export type CollectionKind = z.output<typeof collectionKindSchema>;
export type CollectionEnumerable = z.output<typeof collectionEnumerableSchema>;
export type CollectionSummary = DeepReadonly<
  z.output<typeof collectionSummarySchema>
>;
export type CollectionList = DeepReadonly<
  z.output<typeof collectionListSchema>
>;
export type CollectionCitation = DeepReadonly<
  z.output<typeof collectionCitationSchema>
>;
export type Collection = DeepReadonly<z.output<typeof collectionSchema>>;
export type EventList = DeepReadonly<z.output<typeof eventListSchema>>;
export type EventPerformance = DeepReadonly<
  z.output<typeof eventPerformanceSchema>
>;
export type Event = DeepReadonly<z.output<typeof eventSchema>>;
export type RevisionSummary = DeepReadonly<
  z.output<typeof revisionSummarySchema>
>;
export type RevisionHistory = DeepReadonly<
  z.output<typeof revisionHistorySchema>
>;
export type Revision = DeepReadonly<z.output<typeof revisionSchema>>;

// Compile-time contract checks: each schema's output must equal the generated
// type in both directions (see `Matches`). Each schema is checked once.
type _ContractChecks = [
  // Pieces, terms and persons
  Assert<Matches<typeof pieceKindSchema, Schemas["PieceKind"]>>,
  Assert<
    Matches<typeof conservationStatusSchema, Schemas["ConservationStatus"]>
  >,
  Assert<Matches<z.ZodType<PieceSort>, Schemas["PieceSort"]>>,
  Assert<Matches<typeof letterSchema, Schemas["Letter"]>>,
  Assert<Matches<typeof letterCountSchema, Schemas["LetterCount"]>>,
  Assert<Matches<typeof pieceSummarySchema, Schemas["PieceSummary"]>>,
  Assert<Matches<typeof pieceFacetsSchema, Schemas["PieceFacets"]>>,
  Assert<Matches<typeof pieceListSchema, Schemas["PieceList"]>>,
  Assert<Matches<typeof facetSchema, Schemas["Facet"]>>,
  Assert<Matches<typeof termListItemSchema, Schemas["TermListItem"]>>,
  Assert<Matches<typeof termListSchema, Schemas["TermList"]>>,
  Assert<Matches<typeof personKindSchema, Schemas["PersonKind"]>>,
  Assert<Matches<typeof personSummarySchema, Schemas["PersonSummary"]>>,
  Assert<Matches<typeof personListSchema, Schemas["PersonList"]>>,
  // Shared enums and nested objects
  Assert<Matches<typeof eventKindSchema, Schemas["EventKind"]>>,
  Assert<Matches<typeof licensingStatusSchema, Schemas["LicensingStatus"]>>,
  Assert<Matches<typeof licenceSchema, Schemas["Licence"]>>,
  Assert<Matches<typeof pieceAliasKindSchema, Schemas["PieceAliasKind"]>>,
  Assert<Matches<typeof personAliasKindSchema, Schemas["PersonAliasKind"]>>,
  Assert<Matches<typeof piecePartSchema, Schemas["PiecePart"]>>,
  Assert<Matches<typeof creditRoleSchema, Schemas["CreditRole"]>>,
  Assert<Matches<typeof attributionSchema, Schemas["Attribution"]>>,
  Assert<Matches<typeof certaintySchema, Schemas["Certainty"]>>,
  Assert<Matches<typeof pieceRelationTypeSchema, Schemas["PieceRelationType"]>>,
  Assert<
    Matches<typeof personRelationTypeSchema, Schemas["PersonRelationType"]>
  >,
  Assert<Matches<typeof relationDirectionSchema, Schemas["RelationDirection"]>>,
  Assert<Matches<typeof personStatusSchema, Schemas["PersonStatus"]>>,
  Assert<Matches<typeof personRoleSchema, Schemas["PersonRole"]>>,
  Assert<Matches<typeof linkPlaceTypeSchema, Schemas["LinkPlaceType"]>>,
  Assert<Matches<typeof livenessSchema, Schemas["Liveness"]>>,
  Assert<Matches<typeof linkRoleSchema, Schemas["LinkRole"]>>,
  Assert<Matches<typeof termSummarySchema, Schemas["TermSummary"]>>,
  Assert<Matches<typeof collectionRefSchema, Schemas["CollectionRef"]>>,
  Assert<Matches<typeof eventSummarySchema, Schemas["EventSummary"]>>,
  Assert<Matches<typeof pieceAliasSchema, Schemas["PieceAlias"]>>,
  Assert<Matches<typeof personAliasSchema, Schemas["PersonAlias"]>>,
  Assert<Matches<typeof pieceTermSchema, Schemas["PieceTerm"]>>,
  Assert<Matches<typeof pieceCreditSchema, Schemas["PieceCredit"]>>,
  Assert<Matches<typeof piecePerformanceSchema, Schemas["PiecePerformance"]>>,
  Assert<Matches<typeof performanceLinkSchema, Schemas["PerformanceLink"]>>,
  // The piece and bard pages, the bards directory
  Assert<Matches<typeof pieceLinkSchema, Schemas["PieceLink"]>>,
  Assert<Matches<typeof pieceSchema, Schemas["Piece"]>>,
  Assert<Matches<typeof personLinkSchema, Schemas["PersonLink"]>>,
  Assert<Matches<typeof personProfileSchema, Schemas["PersonProfile"]>>,
  Assert<Matches<typeof personSchema, Schemas["Person"]>>,
  Assert<Matches<z.ZodType<PersonSort>, Schemas["PersonSort"]>>,
  // Categories, collections and events
  Assert<Matches<typeof termChildSchema, Schemas["TermChild"]>>,
  Assert<Matches<typeof termSchema, Schemas["Term"]>>,
  Assert<Matches<typeof collectionKindSchema, Schemas["CollectionKind"]>>,
  Assert<
    Matches<typeof collectionEnumerableSchema, Schemas["CollectionEnumerable"]>
  >,
  Assert<Matches<typeof collectionSummarySchema, Schemas["CollectionSummary"]>>,
  Assert<Matches<typeof collectionListSchema, Schemas["CollectionList"]>>,
  Assert<
    Matches<typeof collectionCitationSchema, Schemas["CollectionCitation"]>
  >,
  Assert<Matches<typeof collectionSchema, Schemas["Collection"]>>,
  Assert<Matches<typeof eventListSchema, Schemas["EventList"]>>,
  Assert<Matches<typeof eventPerformanceSchema, Schemas["EventPerformance"]>>,
  Assert<Matches<typeof eventSchema, Schemas["Event"]>>,
  // Histories and revisions
  Assert<Matches<typeof revisionSourceSchema, Schemas["RevisionSource"]>>,
  Assert<Matches<typeof revisionAuthorSchema, Schemas["RevisionAuthor"]>>,
  Assert<Matches<typeof revisionSummarySchema, Schemas["RevisionSummary"]>>,
  Assert<Matches<typeof revisionHistorySchema, Schemas["RevisionHistory"]>>,
  Assert<Matches<typeof pieceSnapshotSchema, Schemas["PieceSnapshot"]>>,
  Assert<Matches<typeof snapshotPieceLinkSchema, Schemas["SnapshotPieceLink"]>>,
  Assert<
    Matches<typeof snapshotPersonLinkSchema, Schemas["SnapshotPersonLink"]>
  >,
  Assert<
    Matches<
      typeof snapshotPersonPerformanceSchema,
      Schemas["SnapshotPersonPerformance"]
    >
  >,
  Assert<Matches<typeof personSnapshotSchema, Schemas["PersonSnapshot"]>>,
  Assert<
    Matches<
      typeof personSnapshotProfileSchema,
      Schemas["PersonSnapshotProfile"]
    >
  >,
  Assert<Matches<typeof termSnapshotSchema, Schemas["TermSnapshot"]>>,
  Assert<
    Matches<typeof collectionSnapshotSchema, Schemas["CollectionSnapshot"]>
  >,
  Assert<Matches<typeof eventSnapshotSchema, Schemas["EventSnapshot"]>>,
  Assert<Matches<typeof pieceRevisionSchema, Schemas["PieceRevision"]>>,
  Assert<Matches<typeof personRevisionSchema, Schemas["PersonRevision"]>>,
  Assert<Matches<typeof termRevisionSchema, Schemas["TermRevision"]>>,
  Assert<
    Matches<typeof collectionRevisionSchema, Schemas["CollectionRevision"]>
  >,
  Assert<Matches<typeof eventRevisionSchema, Schemas["EventRevision"]>>,
  Assert<Matches<typeof revisionSchema, Schemas["Revision"]>>,
];
