import { z } from "zod";
import type { components } from "~/api/schema.gen";
import {
  ATTRIBUTION_LABELS,
  CERTAINTY_QUALIFIERS,
  COLLECTION_KIND_LABELS,
  CONSERVATION_LABELS,
  CREDIT_ROLE_LABELS,
  ENUMERABLE_LABELS,
  EVENT_KIND_LABELS,
  FACET_LABELS,
  LICENCE_LABELS,
  LICENSING_STATUS_LABELS,
  LINK_PLACE_TYPE_LABELS,
  LINK_ROLE_LABELS,
  PERSON_ALIAS_KIND_LABELS,
  PERSON_KIND_LABELS,
  PERSON_RELATION_LABELS,
  PERSON_ROLE_LABELS,
  PERSON_STATUS_LABELS,
  PIECE_ALIAS_KIND_LABELS,
  PIECE_KIND_LABELS,
  PIECE_PART_LABELS,
  PIECE_RELATION_LABELS,
} from "~/constants/vocabulary";

/**
 * The editor documents (`Editor*Document` in the spec) as zod schemas over
 * the unflattened form (form-codec.ts). Every field has a default, so a
 * missing field is its blank value: `parse({})` is a blank document, and a
 * row added by an intent is a blank row. Blank text is null where the spec
 * allows null, a checkbox is present or not, and a missing list is `[]`.
 * The API validates the rest (422 with a problem per field).
 */

type Schemas = components["schemas"];
export type EntityType = Schemas["EntityType"];
export type PieceDocument = Schemas["EditorPieceDocument"];
export type PersonDocument = Schemas["EditorPersonDocument"];
export type EventDocument = Schemas["EditorEventDocument"];
export type CollectionDocument = Schemas["EditorCollectionDocument"];
export type TermDocument = Schemas["EditorTermDocument"];

/** An enum over a label record's keys, so it lists every value. */
const oneOf = <K extends string>(labels: Readonly<Record<K, unknown>>) =>
  z.enum(Object.keys(labels) as [K, ...K[]]);

const blankToNull = (value: unknown) =>
  value === undefined || (typeof value === "string" && value.trim() === "")
    ? null
    : value;

const maybe = <T extends z.ZodType>(schema: T) =>
  z.preprocess(blankToNull, schema.nullable());

const text = z.string().default("");
const optionalText = maybe(z.string());
const flag = z
  .string()
  .optional()
  .transform(value => value !== undefined);
const int = (fallback: number) =>
  z.preprocess(
    value => blankToNull(value) ?? fallback,
    z.coerce.number().int()
  );
const optionalInt = maybe(z.coerce.number().int());

/** A list: one value of a repeated name is a list of one. */
const many = <T extends z.ZodType>(item: T) =>
  z.preprocess(
    value => (value === undefined ? [] : [value].flat()),
    z.array(item)
  );

/** A row: a blank row (from an `add:` intent) is `{}` with every default. */
const row = <T extends z.ZodRawShape>(shape: T) =>
  z.preprocess(value => value ?? {}, z.object(shape));

const LICENCE_VERSIONS = { "1.0": 0, "2.0": 0, "2.5": 0, "3.0": 0, "4.0": 0 };

const performance = {
  event_slug: optionalText,
  year: optionalInt,
  uploader: optionalText,
  description_verbatim: text,
  performer_slugs: many(z.string()),
};

const link = {
  url: text,
  title: optionalText,
  description: optionalText,
  platform: optionalText,
  place_type: maybe(oneOf(LINK_PLACE_TYPE_LABELS)),
  collection_id: optionalInt,
  locator: optionalText,
  roles: many(oneOf(LINK_ROLE_LABELS)),
};

const licensing = {
  licensing_status: oneOf(LICENSING_STATUS_LABELS).default("unknown"),
  licensing_notes_md: optionalText,
};

const pieceDocument = z.object({
  schema_version: int(1),
  title: text,
  kind: oneOf(PIECE_KIND_LABELS).default("song"),
  secondary_kinds: many(oneOf(PIECE_KIND_LABELS)),
  conservation: row({
    status: oneOf(CONSERVATION_LABELS).default("unassessed"),
    source_url: optionalText,
  }),
  is_stub: flag,
  notes_md: optionalText,
  version_notes_md: optionalText,
  ...licensing,
  licence: maybe(oneOf(LICENCE_LABELS)),
  licence_version: maybe(oneOf(LICENCE_VERSIONS)),
  historical_source_md: optionalText,
  period_start: optionalInt,
  period_end: optionalInt,
  aliases: many(
    row({ text, kind: oneOf(PIECE_ALIAS_KIND_LABELS).default("alt_title") })
  ),
  terms: many(
    row({
      term_slug: text,
      is_primary: flag,
      part: maybe(oneOf(PIECE_PART_LABELS)),
    })
  ),
  relations: many(
    row({
      to_piece_slug: text,
      type: oneOf(PIECE_RELATION_LABELS).default("variant_of"),
    })
  ),
  credits: many(
    row({
      person_slug: optionalText,
      role: oneOf(CREDIT_ROLE_LABELS).default("lyrics"),
      attribution: oneOf({ named: 0, ...ATTRIBUTION_LABELS }).default("named"),
      certainty: oneOf({ certain: 0, ...CERTAINTY_QUALIFIERS }).default(
        "certain"
      ),
      part: maybe(oneOf(PIECE_PART_LABELS)),
      note: optionalText,
    })
  ),
  links: many(row({ ...link, performances: many(row(performance)) })),
}) satisfies z.ZodType<PieceDocument>;

const personDocument = z.object({
  schema_version: int(1),
  name: text,
  kind: oneOf(PERSON_KIND_LABELS).default("community_bard"),
  status: oneOf(PERSON_STATUS_LABELS).default("active"),
  status_date: optionalText,
  status_source_url: optionalText,
  pronouns: optionalText,
  notes_md: optionalText,
  ...licensing,
  is_stub: flag,
  aliases: many(
    row({ name: text, kind: oneOf(PERSON_ALIAS_KIND_LABELS).default("sca") })
  ),
  roles: many(oneOf(PERSON_ROLE_LABELS)),
  affiliation_slugs: many(z.string()),
  relations: many(
    row({
      to_person_slug: text,
      type: oneOf(PERSON_RELATION_LABELS).default("member_of"),
    })
  ),
  links: many(
    row({
      ...link,
      performances: many(row({ piece_slug: optionalText, ...performance })),
    })
  ),
}) satisfies z.ZodType<PersonDocument>;

const termDocument = z.object({
  schema_version: int(1),
  facet: oneOf(FACET_LABELS).default("topic"),
  name: text,
  display_name: text,
  parent_slug: optionalText,
  related_affiliation_slug: optionalText,
  description_md: optionalText,
  position: int(0),
  aliases: many(text),
}) satisfies z.ZodType<TermDocument>;

const collectionDocument = z.object({
  schema_version: int(1),
  name: text,
  url: optionalText,
  kind: oneOf(COLLECTION_KIND_LABELS).default("other"),
  description_md: optionalText,
  region_term_slug: optionalText,
  parent_id: optionalInt,
  is_bardic_resource: flag,
  enumerable: oneOf(ENUMERABLE_LABELS).default("unknown"),
}) satisfies z.ZodType<CollectionDocument>;

const eventDocument = z.object({
  schema_version: int(1),
  name: text,
  kind: oneOf(EVENT_KIND_LABELS).default("event"),
  description_md: optionalText,
}) satisfies z.ZodType<EventDocument>;

/** Each entity type's document schema. */
export const DOCUMENT_SCHEMAS = {
  piece: pieceDocument,
  person: personDocument,
  term: termDocument,
  collection: collectionDocument,
  event: eventDocument,
} as const satisfies Record<EntityType, z.ZodType>;
