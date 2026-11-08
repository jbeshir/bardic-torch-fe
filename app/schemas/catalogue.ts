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
// Terms (C2.2): the facet column's labels and tree

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

const termListItemSchema = z.strictObject({
  slug: z.string(),
  facet: facetSchema,
  name: z.string(),
  display_name: z.string(),
  parent_slug: z.string().nullable(),
  piece_count: z.int().min(0),
  person_count: z.int().min(0),
});

export const termListSchema = z.strictObject({
  data: z.array(termListItemSchema),
});

// ---------------------------------------------------------------------------
// Persons (C3.1): the search page's bards

export const personKindSchema = z.enum([
  "community_bard",
  "historical",
  "group",
]);

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
export type PieceFacets = PieceList["facets"];
export type Facet = z.output<typeof facetSchema>;
export type TermListItem = DeepReadonly<z.output<typeof termListItemSchema>>;
export type TermList = DeepReadonly<z.output<typeof termListSchema>>;
export type PersonKind = z.output<typeof personKindSchema>;
export type PersonSummary = DeepReadonly<z.output<typeof personSummarySchema>>;
export type PersonList = DeepReadonly<z.output<typeof personListSchema>>;

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
  Assert<Matches<typeof letterCountSchema, Schemas["LetterCount"]>>,
  Assert<Matches<typeof personKindSchema, Schemas["PersonKind"]>>,
  Assert<Matches<typeof personSummarySchema, Schemas["PersonSummary"]>>,
  Assert<Matches<typeof personListSchema, Schemas["PersonList"]>>,
];

// ---------------------------------------------------------------------------
// The piece page (C4.1): `getPiece`'s body and what it nests.
// ---------------------------------------------------------------------------

const eventKindSchema = z.enum(["venue", "event"]);

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

const piecePartSchema = z.enum(["words", "tune", "verses", "chorus"]);

/** The credit roles, in the order a person's works are grouped by. */
export const creditRoleSchema = z.enum([
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

const relationDirectionSchema = z.enum(["outgoing", "incoming"]);

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
export const linkRoleSchema = z.enum([
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

const piecePerformanceSchema = z.strictObject({
  year: z.int().nullable(),
  uploader: z.string().nullable(),
  description_verbatim: z.string(),
  event: eventSummarySchema.nullable(),
  performers: z.array(personSummarySchema),
});

/** The fields every link has, a piece's or a person's. */
const linkFields = {
  url: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  platform: z.string().nullable(),
  place_type: linkPlaceTypeSchema.nullable(),
  collection: collectionRefSchema.nullable(),
  locator: z.string().nullable(),
  liveness: livenessSchema,
  last_checked_at: z.string().nullable(),
  archived_url: z.string().nullable(),
  roles: z.array(linkRoleSchema),
};

const pieceLinkSchema = z.strictObject({
  ...linkFields,
  performances: z.array(piecePerformanceSchema),
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
  aliases: z.array(
    z.strictObject({ text: z.string(), kind: pieceAliasKindSchema })
  ),
  terms: z.array(
    z.strictObject({
      term: termSummarySchema,
      is_primary: z.boolean(),
      part: piecePartSchema.nullable(),
    })
  ),
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

export type Piece = DeepReadonly<z.output<typeof pieceSchema>>;
export type PieceAliasKind = z.output<typeof pieceAliasKindSchema>;
export type PiecePart = z.output<typeof piecePartSchema>;
export type CreditRole = z.output<typeof creditRoleSchema>;
export type Attribution = z.output<typeof attributionSchema>;
export type Certainty = z.output<typeof certaintySchema>;
export type LinkRole = z.output<typeof linkRoleSchema>;
export type LinkPlaceType = z.output<typeof linkPlaceTypeSchema>;
export type Licence = z.output<typeof licenceSchema>;
export type LicensingStatus = z.output<typeof licensingStatusSchema>;
export type PieceRelationType = z.output<typeof pieceRelationTypeSchema>;
export type RelationDirection = z.output<typeof relationDirectionSchema>;

type _PieceContractChecks = [
  Assert<Matches<typeof eventKindSchema, Schemas["EventKind"]>>,
  Assert<Matches<typeof licensingStatusSchema, Schemas["LicensingStatus"]>>,
  Assert<Matches<typeof licenceSchema, Schemas["Licence"]>>,
  Assert<Matches<typeof pieceAliasKindSchema, Schemas["PieceAliasKind"]>>,
  Assert<Matches<typeof piecePartSchema, Schemas["PiecePart"]>>,
  Assert<Matches<typeof creditRoleSchema, Schemas["CreditRole"]>>,
  Assert<Matches<typeof attributionSchema, Schemas["Attribution"]>>,
  Assert<Matches<typeof certaintySchema, Schemas["Certainty"]>>,
  Assert<Matches<typeof pieceRelationTypeSchema, Schemas["PieceRelationType"]>>,
  Assert<Matches<typeof relationDirectionSchema, Schemas["RelationDirection"]>>,
  Assert<Matches<typeof linkPlaceTypeSchema, Schemas["LinkPlaceType"]>>,
  Assert<Matches<typeof livenessSchema, Schemas["Liveness"]>>,
  Assert<Matches<typeof linkRoleSchema, Schemas["LinkRole"]>>,
  Assert<Matches<typeof termSummarySchema, Schemas["TermSummary"]>>,
  Assert<Matches<typeof collectionRefSchema, Schemas["CollectionRef"]>>,
  Assert<Matches<typeof eventSummarySchema, Schemas["EventSummary"]>>,
  Assert<Matches<typeof piecePerformanceSchema, Schemas["PiecePerformance"]>>,
  Assert<Matches<typeof pieceLinkSchema, Schemas["PieceLink"]>>,
  Assert<Matches<typeof pieceCreditSchema, Schemas["PieceCredit"]>>,
  Assert<Matches<typeof pieceSchema, Schemas["Piece"]>>,
];

// ---------------------------------------------------------------------------
// The bard page (C5.1): `getPerson`'s body.
// ---------------------------------------------------------------------------

const personStatusSchema = z.enum(["active", "deceased", "prefers_no_page"]);

const personAliasKindSchema = z.enum([
  "legal",
  "sca",
  "stage",
  "nickname",
  "former",
  "redirect",
]);

const personRelationTypeSchema = z.enum(["heir_of", "member_of", "same_as"]);

export const personRoleSchema = z.enum([
  "singer",
  "songwriter",
  "musician",
  "instrumentalist",
  "storyteller",
  "poet",
  "jester",
  "dancer",
]);

const personLinkSchema = z.strictObject(linkFields);

const personProfileSchema = z.strictObject({
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
        link: z.strictObject({
          url: z.string(),
          title: z.string().nullable(),
          platform: z.string().nullable(),
        }),
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

export type Person = DeepReadonly<z.output<typeof personSchema>>;
export type PersonAliasKind = z.output<typeof personAliasKindSchema>;
export type PersonRole = z.output<typeof personRoleSchema>;
export type PersonRelationType = z.output<typeof personRelationTypeSchema>;

type _PersonContractChecks = [
  Assert<Matches<typeof personStatusSchema, Schemas["PersonStatus"]>>,
  Assert<Matches<typeof personAliasKindSchema, Schemas["PersonAliasKind"]>>,
  Assert<
    Matches<typeof personRelationTypeSchema, Schemas["PersonRelationType"]>
  >,
  Assert<Matches<typeof personRoleSchema, Schemas["PersonRole"]>>,
  Assert<Matches<typeof personLinkSchema, Schemas["PersonLink"]>>,
  Assert<Matches<typeof personProfileSchema, Schemas["PersonProfile"]>>,
  Assert<Matches<typeof personSchema, Schemas["Person"]>>,
];

// ---------------------------------------------------------------------------
// The bards directory (C5.2): its sort. `personListSchema` and
// `termListSchema` are above, shared with search and the facets.
// ---------------------------------------------------------------------------

export const personSortSchema = z.enum(["name", "relevance"]);

export type PersonSort = z.output<typeof personSortSchema>;

type _DirectoryContractChecks = [
  Assert<Matches<typeof personSortSchema, Schemas["PersonSort"]>>,
];
