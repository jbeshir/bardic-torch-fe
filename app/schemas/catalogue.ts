import { z } from "zod";
import type { components, operations } from "~/api/schema.gen";
import type { Assert, DeepReadonly, Matches } from "./contract";

/**
 * Runtime schemas for the catalogue's response bodies, each checked at
 * compile time against the generated spec types in both directions. The
 * spec's objects are closed, so every object here is strict: a field the
 * spec doesn't declare is a contract break (502), not data to pass on.
 *
 * The enum tuples are exported in the spec's order, which is the order the
 * API lists facet counts in and the order the URL state sorts values in
 * (`app/catalogue/query-state.ts`); read them as `schema.options`.
 * Schemas are added with the first loader that parses them.
 */

type Schemas = components["schemas"];

export const pieceKindSchema = z.enum([
  "song",
  "poem",
  "story",
  "dance_music",
  "instrumental",
  "comedy",
]);

export const conservationStatusSchema = z.enum([
  "unassessed",
  "low_risk",
  "endangered",
  "critically_endangered",
  "restricted",
]);

export const pieceSortSchema = z.enum(["title", "relevance"]);

export const letterSchema = z.enum([
  "0",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
]);

/** A count the API lists: only values with at least one match appear. */
const countSchema = z.int().min(1);

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
  letters: z.array(
    z.strictObject({ letter: letterSchema, count: countSchema })
  ),
});

export const pieceListSchema = z.strictObject({
  data: z.array(pieceSummarySchema),
  total: z.int().min(0),
  facets: pieceFacetsSchema,
});

// ---------------------------------------------------------------------------
// Terms (track C: /categories)

export const facetSchema = z.enum([
  "mood",
  "topic",
  "culture",
  "language",
  "legendaria",
  "form",
  "origin",
  "other",
  "affiliation",
]);

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

const personKindSchema = z.enum(["community_bard", "historical", "group"]);

const personSummarySchema = z.strictObject({
  slug: z.string(),
  name: z.string(),
  kind: personKindSchema,
  is_stub: z.boolean(),
});

const termSummarySchema = z.strictObject({
  slug: z.string(),
  facet: facetSchema,
  display_name: z.string(),
});

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
// Collections (track C: /collections)

export const collectionKindSchema = z.enum([
  "index_or_link_list",
  "songbook_pdf",
  "songbook_website",
  "website",
  "wiki_category",
  "wiki",
  "youtube_channel",
  "youtube_playlist",
  "google_doc_songbook",
  "blog",
  "archived_songbook",
  "hosted_document",
  "other",
]);

const collectionEnumerableSchema = z.enum([
  "unknown",
  "yes",
  "pdf",
  "browser",
  "api",
  "no",
]);

const linkRoleSchema = z.enum([
  "official",
  "lyrics",
  "text",
  "sheet_music",
  "dance_instructions",
  "text_source",
  "translation",
  "performance",
  "licensing_source",
  "website",
  "external_profile",
  "other",
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
  letters: z.array(
    z.strictObject({ letter: letterSchema, count: countSchema })
  ),
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
// Events (track C: /events)

export const eventKindSchema = z.enum(["venue", "event"]);

const eventSummarySchema = z.strictObject({
  slug: z.string(),
  name: z.string(),
  kind: eventKindSchema,
});

export const eventListSchema = z.strictObject({
  data: z.array(eventSummarySchema),
  total: z.int().min(0),
});

const performanceLinkSchema = z.strictObject({
  url: z.string(),
  title: z.string().nullable(),
  platform: z.string().nullable(),
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
// Histories (track C: */history)

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
const creditRoleSchema = z.enum([
  "lyrics",
  "tune",
  "author",
  "choreography",
  "music",
  "arrangement",
  "translation",
]);
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
const personRoleSchema = z.enum([
  "singer",
  "songwriter",
  "musician",
  "instrumentalist",
  "storyteller",
  "poet",
  "jester",
  "dancer",
]);
const personStatusSchema = z.enum(["active", "deceased", "prefers_no_page"]);
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

const collectionRefSchema = z.strictObject({
  id: z.int().min(1),
  name: z.string(),
});

const pieceAliasSchema = z.strictObject({
  text: z.string(),
  kind: pieceAliasKindSchema,
});

const pieceTermSchema = z.strictObject({
  term: termSummarySchema,
  is_primary: z.boolean(),
  part: piecePartSchema.nullable(),
});

const pieceCreditSchema = z.strictObject({
  role: creditRoleSchema,
  attribution: attributionSchema,
  certainty: certaintySchema,
  part: piecePartSchema.nullable(),
  note: z.string().nullable(),
  person: personSummarySchema.nullable(),
});

const piecePerformanceSchema = z.strictObject({
  year: z.int().nullable(),
  uploader: z.string().nullable(),
  description_verbatim: z.string(),
  event: eventSummarySchema.nullable(),
  performers: z.array(personSummarySchema),
});

/** What a snapshot's link shares, whatever it is attached to. */
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
  aliases: z.array(
    z.strictObject({ name: z.string(), kind: personAliasKindSchema })
  ),
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
export type PieceSort = z.output<typeof pieceSortSchema>;
export type PieceSummary = DeepReadonly<z.output<typeof pieceSummarySchema>>;
export type PieceList = DeepReadonly<z.output<typeof pieceListSchema>>;
export type Facet = z.output<typeof facetSchema>;
export type TermListItem = DeepReadonly<z.output<typeof termListItemSchema>>;
export type TermList = DeepReadonly<z.output<typeof termListSchema>>;
export type PersonKind = z.output<typeof personKindSchema>;
export type PersonSummary = DeepReadonly<z.output<typeof personSummarySchema>>;
export type TermSummary = DeepReadonly<z.output<typeof termSummarySchema>>;
export type Term = DeepReadonly<z.output<typeof termSchema>>;
export type CollectionKind = z.output<typeof collectionKindSchema>;
export type CollectionEnumerable = z.output<typeof collectionEnumerableSchema>;
export type LinkRole = z.output<typeof linkRoleSchema>;
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
export type EventKind = z.output<typeof eventKindSchema>;
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
export type PersonRole = z.output<typeof personRoleSchema>;
export type PersonStatus = z.output<typeof personStatusSchema>;
export type LinkPlaceType = z.output<typeof linkPlaceTypeSchema>;

// Compile-time contract checks: each schema's output must equal the generated
// type in both directions (see `Matches`).
type _ContractChecks = [
  Assert<Matches<typeof pieceKindSchema, Schemas["PieceKind"]>>,
  Assert<
    Matches<typeof conservationStatusSchema, Schemas["ConservationStatus"]>
  >,
  Assert<Matches<typeof pieceSortSchema, Schemas["PieceSort"]>>,
  Assert<Matches<typeof letterSchema, Schemas["Letter"]>>,
  Assert<Matches<typeof pieceSummarySchema, Schemas["PieceSummary"]>>,
  Assert<Matches<typeof pieceFacetsSchema, Schemas["PieceFacets"]>>,
  Assert<Matches<typeof pieceListSchema, Schemas["PieceList"]>>,
  Assert<Matches<typeof facetSchema, Schemas["Facet"]>>,
  Assert<Matches<typeof termListItemSchema, Schemas["TermListItem"]>>,
  Assert<Matches<typeof termListSchema, Schemas["TermList"]>>,
  Assert<Matches<typeof personKindSchema, Schemas["PersonKind"]>>,
  Assert<Matches<typeof personSummarySchema, Schemas["PersonSummary"]>>,
  Assert<Matches<typeof termSummarySchema, Schemas["TermSummary"]>>,
  Assert<Matches<typeof termChildSchema, Schemas["TermChild"]>>,
  Assert<Matches<typeof termSchema, Schemas["Term"]>>,
  Assert<Matches<typeof collectionKindSchema, Schemas["CollectionKind"]>>,
  Assert<
    Matches<typeof collectionEnumerableSchema, Schemas["CollectionEnumerable"]>
  >,
  Assert<Matches<typeof linkRoleSchema, Schemas["LinkRole"]>>,
  Assert<Matches<typeof collectionSummarySchema, Schemas["CollectionSummary"]>>,
  Assert<Matches<typeof collectionListSchema, Schemas["CollectionList"]>>,
  Assert<
    Matches<typeof collectionCitationSchema, Schemas["CollectionCitation"]>
  >,
  Assert<Matches<typeof collectionSchema, Schemas["Collection"]>>,
  Assert<Matches<typeof eventKindSchema, Schemas["EventKind"]>>,
  Assert<Matches<typeof eventSummarySchema, Schemas["EventSummary"]>>,
  Assert<Matches<typeof eventListSchema, Schemas["EventList"]>>,
  Assert<Matches<typeof performanceLinkSchema, Schemas["PerformanceLink"]>>,
  Assert<Matches<typeof eventPerformanceSchema, Schemas["EventPerformance"]>>,
  Assert<Matches<typeof eventSchema, Schemas["Event"]>>,
  Assert<Matches<typeof revisionSourceSchema, Schemas["RevisionSource"]>>,
  Assert<Matches<typeof revisionAuthorSchema, Schemas["RevisionAuthor"]>>,
  Assert<Matches<typeof revisionSummarySchema, Schemas["RevisionSummary"]>>,
  Assert<Matches<typeof revisionHistorySchema, Schemas["RevisionHistory"]>>,
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
  Assert<Matches<typeof personRoleSchema, Schemas["PersonRole"]>>,
  Assert<Matches<typeof personStatusSchema, Schemas["PersonStatus"]>>,
  Assert<Matches<typeof linkPlaceTypeSchema, Schemas["LinkPlaceType"]>>,
  Assert<Matches<typeof collectionRefSchema, Schemas["CollectionRef"]>>,
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
