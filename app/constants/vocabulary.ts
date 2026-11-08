import type {
  Attribution,
  Certainty,
  CreditRole,
  Licence,
  LicensingStatus,
  LinkPlaceType,
  PersonAliasKind,
  PersonRelationType,
  PersonRole,
  PersonStatus,
  PieceAliasKind,
  PiecePart,
  PieceRelationType,
  CollectionEnumerable,
  CollectionKind,
  ConservationStatus,
  EventKind,
  Facet,
  Letter,
  LinkRole,
  PersonKind,
  PieceKind,
} from "~/schemas/catalogue";

/**
 * Display labels for the API's enums (DESIGN §11), one `Record` per enum so
 * a new value is a type error until it has a label.
 */

/**
 * Every status, in the order the conservation help page lists them.
 * `satisfies` fails the type check if the API renames or drops a value;
 * a value it adds is a type error in `CONSERVATION_LABELS` and fails the
 * vocabulary test, so the list can't drift.
 */
export const CONSERVATION_STATUSES = [
  "low_risk",
  "endangered",
  "critically_endangered",
  "restricted",
  "unassessed",
] as const satisfies readonly ConservationStatus[];

/** Each status's label, in sentence case (DESIGN §2.5). */
export const CONSERVATION_LABELS: Readonly<Record<ConservationStatus, string>> =
  {
    low_risk: "Low risk",
    endangered: "Endangered",
    critically_endangered: "Critically endangered",
    restricted: "Restricted",
    unassessed: "Not yet assessed",
  };

/**
 * Each status's row id on the conservation help page: the row's first cell
 * slugged like a heading, so hyphenated (FE1's anchors, which other pages and
 * the e2e specs link to). The help-content test checks every one exists.
 */
const CONSERVATION_ANCHORS: Readonly<Record<ConservationStatus, string>> = {
  low_risk: "low-risk",
  endangered: "endangered",
  critically_endangered: "critically-endangered",
  restricted: "restricted",
  unassessed: "unassessed",
};

/** Where a status is explained: its row on the conservation help page. */
export function conservationHelpPath(status: ConservationStatus): string {
  return `/help/conservation-status#${CONSERVATION_ANCHORS[status]}`;
}

/** Each piece kind's label, in sentence case: "Dance music". */
export const PIECE_KIND_LABELS: Readonly<Record<PieceKind, string>> = {
  song: "Song",
  poem: "Poem",
  story: "Story",
  dance_music: "Dance music",
  instrumental: "Instrumental",
  comedy: "Comedy",
};

/**
 * An A–Z letter as a reader reads it: `0` is the index's catch-all for
 * sort keys that start with a digit, punctuation or another script.
 */
export function letterLabel(letter: Letter): string {
  return letter === "0" ? "0–9 and others" : letter;
}

// ---------------------------------------------------------------------------
// Track C (categories, collections, events, history, revisions)

/** Each facet's label, in sentence case: the categories index's sections. */
export const FACET_LABELS: Readonly<Record<Facet, string>> = {
  mood: "Mood",
  topic: "Topic",
  culture: "Culture",
  language: "Language",
  legendaria: "Legendaria",
  form: "Form",
  origin: "Origin",
  other: "Other",
  affiliation: "Affiliation",
};

/** Each person kind's label, in sentence case. */
export const PERSON_KIND_LABELS: Readonly<Record<PersonKind, string>> = {
  community_bard: "Community bard",
  historical: "Historical figure",
  group: "Group",
};

/** Each collection kind's label, in sentence case. */
export const COLLECTION_KIND_LABELS: Readonly<Record<CollectionKind, string>> =
  {
    index_or_link_list: "Index or link list",
    songbook_pdf: "Songbook (PDF)",
    songbook_website: "Songbook website",
    website: "Website",
    wiki_category: "Wiki category",
    wiki: "Wiki",
    youtube_channel: "YouTube channel",
    youtube_playlist: "YouTube playlist",
    google_doc_songbook: "Songbook (Google Doc)",
    blog: "Blog",
    archived_songbook: "Archived songbook",
    hosted_document: "Hosted document",
    other: "Other",
  };

/** Whether, and how, a collection's contents can be listed. */
export const ENUMERABLE_LABELS: Readonly<Record<CollectionEnumerable, string>> =
  {
    yes: "Yes",
    pdf: "From a PDF",
    browser: "In a browser",
    api: "Through an API",
    no: "No",
    unknown: "Not yet assessed",
  };

/** What a link is for, in sentence case. */
export const LINK_ROLE_LABELS: Readonly<Record<LinkRole, string>> = {
  official: "Official",
  lyrics: "Lyrics",
  text: "Text",
  sheet_music: "Sheet music",
  dance_instructions: "Dance instructions",
  text_source: "Text source",
  translation: "Translation",
  performance: "Performance",
  licensing_source: "Licensing source",
  website: "Website",
  external_profile: "External profile",
  other: "Other",
};

/** Each event kind's label. */
export const EVENT_KIND_LABELS: Readonly<Record<EventKind, string>> = {
  event: "Event",
  venue: "Venue",
};

/** Each licence by family name, never a version (plan §4.0, spec issue B13). */
export const LICENCE_LABELS: Readonly<Record<Licence, string>> = {
  pd: "Public domain",
  cc_by: "Creative Commons Attribution",
  cc_by_sa: "Creative Commons Attribution-ShareAlike",
  cc_by_nc: "Creative Commons Attribution-NonCommercial",
  cc_by_nc_sa: "Creative Commons Attribution-NonCommercial-ShareAlike",
  cc_by_nd: "Creative Commons Attribution-NoDerivatives",
  cc_by_nc_nd: "Creative Commons Attribution-NonCommercial-NoDerivatives",
  arr: "All rights reserved",
  other: "Another licence",
};

export const LICENSING_STATUS_LABELS: Readonly<
  Record<LicensingStatus, string>
> = {
  known: "Known",
  unknown: "Not yet known",
};

export const PIECE_ALIAS_KIND_LABELS: Readonly<Record<PieceAliasKind, string>> =
  {
    alt_title: "Other title",
    nickname: "Nickname",
    subtitle: "Subtitle",
    redirect: "Old name",
  };

export const PERSON_ALIAS_KIND_LABELS: Readonly<
  Record<PersonAliasKind, string>
> = {
  legal: "Legal name",
  sca: "SCA name",
  stage: "Stage name",
  nickname: "Nickname",
  former: "Former name",
  redirect: "Old name",
};

export const PIECE_PART_LABELS: Readonly<Record<PiecePart, string>> = {
  words: "Words",
  tune: "Tune",
  verses: "Verses",
  chorus: "Chorus",
};

export const CREDIT_ROLE_LABELS: Readonly<Record<CreditRole, string>> = {
  lyrics: "Lyrics",
  tune: "Tune",
  author: "Author",
  choreography: "Choreography",
  music: "Music",
  arrangement: "Arrangement",
  translation: "Translation",
};

export const ATTRIBUTION_LABELS: Readonly<Record<Attribution, string>> = {
  named: "Named",
  traditional: "Traditional",
  unknown: "Unknown",
  anonymous: "Anonymous",
  various: "Various",
};

export const CERTAINTY_LABELS: Readonly<Record<Certainty, string>> = {
  certain: "Certain",
  probable: "Probable",
  possible: "Possible",
  disputed: "Disputed",
};

export const PIECE_RELATION_LABELS: Readonly<
  Record<PieceRelationType, string>
> = {
  variant_of: "Variant of",
  contrafactum_of: "Contrafactum of",
  setting_of: "Setting of",
  same_text_other_form: "Same text, other form",
};

export const PERSON_RELATION_LABELS: Readonly<
  Record<PersonRelationType, string>
> = {
  heir_of: "Heir of",
  member_of: "Member of",
  same_as: "Same as",
};

export const PERSON_ROLE_LABELS: Readonly<Record<PersonRole, string>> = {
  singer: "Singer",
  songwriter: "Songwriter",
  musician: "Musician",
  instrumentalist: "Instrumentalist",
  storyteller: "Storyteller",
  poet: "Poet",
  jester: "Jester",
  dancer: "Dancer",
};

export const PERSON_STATUS_LABELS: Readonly<Record<PersonStatus, string>> = {
  active: "Active",
  deceased: "Deceased",
  prefers_no_page: "Prefers not to have a page",
};

export const LINK_PLACE_TYPE_LABELS: Readonly<Record<LinkPlaceType, string>> = {
  recording_platform: "Recording platform",
  streaming: "Streaming",
  author_site: "Author’s site",
  community_archive: "Community archive",
  physical_archive: "Physical archive",
  book: "Book",
  vendor: "Vendor",
  author_contact: "Author contact",
  oral_tradition: "Oral tradition",
  other: "Other",
};
