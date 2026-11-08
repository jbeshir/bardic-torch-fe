/**
 * The catalogue's enum values, in the spec's order (the order the API
 * lists facet counts in and the URL state sorts values in), with no zod:
 * the browser reads these, and `app/schemas/catalogue.ts` builds its
 * `z.enum`s from them, so zod and the response schemas stay on the
 * server. The schemas' compile-time checks against the spec's types keep
 * each list exact.
 */

/** A piece's kind (`PieceKind`). */
export const PIECE_KINDS = [
  "song",
  "poem",
  "story",
  "dance_music",
  "instrumental",
  "comedy",
] as const;

/**
 * A piece's conservation status, in the spec's order (the help page's
 * order is `CONSERVATION_STATUSES`, in `vocabulary.ts`).
 */
export const CONSERVATION_STATUS_VALUES = [
  "unassessed",
  "low_risk",
  "endangered",
  "critically_endangered",
  "restricted",
] as const;

/** How `/pieces` can be ordered. */
export const PIECE_SORTS = ["title", "relevance"] as const;

/** The A–Z's letters, `0` first for digits and others. */
export const LETTERS = [
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
] as const;

/** A term's facet. */
export const FACETS = [
  "mood",
  "topic",
  "culture",
  "language",
  "legendaria",
  "form",
  "origin",
  "other",
  "affiliation",
] as const;

/** A person's kind. */
export const PERSON_KINDS = ["community_bard", "historical", "group"] as const;

/** An event's kind: a venue or an event. */
export const EVENT_KINDS = ["venue", "event"] as const;

/** A credit's role in a piece. */
export const CREDIT_ROLES = [
  "lyrics",
  "tune",
  "author",
  "choreography",
  "music",
  "arrangement",
  "translation",
] as const;

/** A person's role. */
export const PERSON_ROLES = [
  "singer",
  "songwriter",
  "musician",
  "instrumentalist",
  "storyteller",
  "poet",
  "jester",
  "dancer",
] as const;

/** A link's role for its piece. */
export const LINK_ROLES = [
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
] as const;

/** How `/bards` can be ordered. */
export const PERSON_SORTS = ["name", "relevance"] as const;

/** A collection's kind. */
export const COLLECTION_KINDS = [
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
] as const;
