import type {
  Attribution,
  Certainty,
  CollectionKind,
  ConservationStatus,
  CreditRole,
  Facet,
  Letter,
  LinkPlaceType,
  LinkRole,
  PersonAliasKind,
  PersonKind,
  PersonRole,
  PieceAliasKind,
  PieceKind,
} from "~/schemas/catalogue";

/**
 * Display labels for the API's enums, one `Record` per enum so
 * a new value is a type error until it has a label.
 */

/**
 * Every status.
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

/** "Browse endangered pieces": each status's link to the pieces with it. */
export const BROWSE_STATUS_LABELS: Readonly<
  Record<ConservationStatus, string>
> = {
  low_risk: "Browse low-risk pieces",
  endangered: "Browse endangered pieces",
  critically_endangered: "Browse critically endangered pieces",
  restricted: "Browse restricted pieces",
  unassessed: "Browse pieces not yet assessed",
};

/** Each piece kind's label, in sentence case: "Dance music". */
export const PIECE_KIND_LABELS: Readonly<Record<PieceKind, string>> = {
  song: "Song",
  poem: "Poem",
  story: "Story",
  dance_music: "Dance music",
  instrumental: "Instrumental",
};

/**
 * An A–Z letter as a reader reads it: `0` is the index's catch-all for
 * sort keys that start with a digit, punctuation or another script.
 */
export function letterLabel(letter: Letter): string {
  return letter === "0" ? "0–9 and others" : letter;
}

// ---------------------------------------------------------------------------
// Facets

/**
 * Each facet's label, in sentence case: the facet column's legends, the
 * prefix of a piece page's category chips ("Mood: Singalong") and the
 * categories index's sections.
 */
export const FACET_LABELS: Readonly<Record<Facet, string>> = {
  mood: "Mood",
  topic: "Topic",
  culture: "Culture",
  language: "Language",
  legendaria: "Legendaria",
  origin: "Origin",
  other: "Other",
  affiliation: "Affiliation",
};

// ---------------------------------------------------------------------------
// The piece page: its infobox and category chips.
// ---------------------------------------------------------------------------

/** Each credit role as its infobox row's label: "Words". */
export const CREDIT_ROLE_LABELS: Readonly<Record<CreditRole, string>> = {
  lyrics: "Words",
  tune: "Tune",
  lyrics_and_tune: "Words and tune",
  author: "Author",
};

/**
 * A credit that names no one, by its attribution. A `named` credit shows
 * the person instead.
 */
export const ATTRIBUTION_LABELS: Readonly<
  Record<Exclude<Attribution, "named">, string>
> = {
  traditional: "Traditional",
  unknown: "Unknown",
  anonymous: "Anonymous",
  various: "Various",
};

/**
 * A credit to a person not yet on the site, by the name the edit typed
 * (until a moderator approves it): "Sorrel Wayfarer (new person)".
 */
export const newPersonLabel = (name: string) => `${name} (new person)`;

/** The word after a credit that isn't certain: "probably". */
export const CERTAINTY_QUALIFIERS: Readonly<
  Record<Exclude<Certainty, "certain">, string>
> = {
  probable: "probably",
  possible: "possibly",
  disputed: "disputed",
};

/**
 * What kind of other name an alias is. A page never shows a `redirect`
 * alias (a search aid).
 */
export const PIECE_ALIAS_KIND_LABELS: Readonly<Record<PieceAliasKind, string>> =
  {
    alt_title: "alternative title",
    subtitle: "subtitle",
    redirect: "old title",
  };

// ---------------------------------------------------------------------------
// Links: where a piece or a person can be found.
// ---------------------------------------------------------------------------

/** Each link role as the heading of its links: "Text sources". */
export const LINK_ROLE_HEADINGS: Readonly<Record<LinkRole, string>> = {
  official: "Official",
  lyrics: "Lyrics",
  text: "Text",
  sheet_music: "Sheet music",
  dance_instructions: "Dance instructions",
  text_source: "Text sources",
  translation: "Translations",
  performance: "Performances",
  licensing_source: "Licensing sources",
  website: "Websites",
  external_profile: "External profiles",
  other: "Other",
};

/**
 * Each link role as one role's name, in a list of a link's roles ("Lyrics,
 * Text source"): a citation's roles.
 */
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

/** What kind of place a link is, in its caption: "community archive". */
export const LINK_PLACE_TYPE_LABELS: Readonly<Record<LinkPlaceType, string>> = {
  recording_platform: "recording platform",
  streaming: "streaming service",
  author_site: "author’s site",
  community_archive: "community archive",
  book: "book",
};

// ---------------------------------------------------------------------------
// Persons: search, the bards directory and the bard page.
// ---------------------------------------------------------------------------

/**
 * Each person kind's label, in sentence case: a list row's kind and the
 * bard page's meta line.
 */
export const PERSON_KIND_LABELS: Readonly<Record<PersonKind, string>> = {
  community_bard: "Community bard",
  historical: "Historical figure",
  group: "Group",
};

/** What a person who is no longer active did, by kind: a group disbands. */
export const DECEASED_LABELS: Readonly<Record<PersonKind, string>> = {
  community_bard: "Died",
  historical: "Died",
  group: "Disbanded",
};

/**
 * What kind of other name a person's alias is. A public legal name is
 * just their name.
 */
export const PERSON_ALIAS_KIND_LABELS: Readonly<
  Record<PersonAliasKind, string>
> = {
  legal: "Name",
  sca: "SCA name",
};

/** Each role a person takes, in sentence case. */
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

/** A person's works under one credit role, as a heading: "Tunes (3)". */
export const WORK_ROLE_HEADINGS: Readonly<Record<CreditRole, string>> = {
  lyrics: "Words",
  tune: "Tunes",
  lyrics_and_tune: "Words and tunes",
  author: "Writings",
};

// ---------------------------------------------------------------------------
// Collections, events
// ---------------------------------------------------------------------------

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
  };
