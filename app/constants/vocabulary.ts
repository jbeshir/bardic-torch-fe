import type { CcLicence } from "~/constants/licences";
import type {
  Attribution,
  Certainty,
  ConservationStatus,
  CreditRole,
  Facet,
  Letter,
  Licence,
  LinkPlaceType,
  LinkRole,
  PersonAliasKind,
  PersonKind,
  PersonRelationType,
  PersonRole,
  PieceAliasKind,
  PieceKind,
  PiecePart,
  PieceRelationType,
  RelationDirection,
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
// The piece page (C4.1): its infobox and category chips.
// ---------------------------------------------------------------------------

/** Each facet's name, the prefix of its chips: "Mood: Singalong". */
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

/** Each credit role as its infobox row's label: "Words". */
export const CREDIT_ROLE_LABELS: Readonly<Record<CreditRole, string>> = {
  lyrics: "Words",
  tune: "Tune",
  author: "Author",
  choreography: "Choreography",
  music: "Music",
  arrangement: "Arrangement",
  translation: "Translation",
};

/** The part of a piece a credit or an origin is for: "Tune". */
export const PIECE_PART_LABELS: Readonly<Record<PiecePart, string>> = {
  words: "Words",
  tune: "Tune",
  verses: "Verses",
  chorus: "Chorus",
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

/** The word after a credit that isn't certain: "probably". */
export const CERTAINTY_QUALIFIERS: Readonly<
  Record<Exclude<Certainty, "certain">, string>
> = {
  probable: "probably",
  possible: "possibly",
  disputed: "disputed",
};

/**
 * What kind of other name an alias is. `redirect` aliases are search aids,
 * never shown, so they have no label.
 */
export const PIECE_ALIAS_KIND_LABELS: Readonly<
  Record<Exclude<PieceAliasKind, "redirect">, string>
> = {
  alt_title: "alternative title",
  nickname: "nickname",
  subtitle: "subtitle",
};

// ---------------------------------------------------------------------------
// Links (C4.3): where a piece or a person can be found.
// ---------------------------------------------------------------------------

/** Each link role as the heading of its links: "Sheet music". */
export const LINK_ROLE_LABELS: Readonly<Record<LinkRole, string>> = {
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

/** What kind of place a link is, in its caption: "community archive". */
export const LINK_PLACE_TYPE_LABELS: Readonly<Record<LinkPlaceType, string>> = {
  recording_platform: "recording platform",
  streaming: "streaming service",
  author_site: "author’s site",
  community_archive: "community archive",
  physical_archive: "physical archive",
  book: "book",
  vendor: "shop",
  author_contact: "author contact",
  oral_tradition: "oral tradition",
  other: "other place",
};

// ---------------------------------------------------------------------------
// Licensing and relations (C4.4).
// ---------------------------------------------------------------------------

/**
 * Each licence's full name, never with a version: the API records the
 * family only (plan §4.0, spec issue B13).
 */
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

/**
 * The Creative Commons licences' short names, for the infobox: "CC BY-SA".
 * The other licences have none, so the infobox says only "Known".
 */
export const CC_LICENCE_SHORT_NAMES: Readonly<Record<CcLicence, string>> = {
  cc_by: "CC BY",
  cc_by_sa: "CC BY-SA",
  cc_by_nc: "CC BY-NC",
  cc_by_nc_sa: "CC BY-NC-SA",
  cc_by_nd: "CC BY-ND",
  cc_by_nc_nd: "CC BY-NC-ND",
};

/**
 * Each relation between pieces, read from this piece's side: an outgoing
 * one is what this piece is ("Variant of" the other), an incoming one what
 * the others are of it ("Variants"). A text in another form is the same
 * both ways.
 */
export const PIECE_RELATION_LABELS: Readonly<
  Record<PieceRelationType, Readonly<Record<RelationDirection, string>>>
> = {
  variant_of: { outgoing: "Variant of", incoming: "Variants" },
  contrafactum_of: { outgoing: "Contrafactum of", incoming: "Contrafacta" },
  setting_of: { outgoing: "Setting of", incoming: "Settings" },
  same_text_other_form: {
    outgoing: "Same text in another form",
    incoming: "Same text in another form",
  },
};

// ---------------------------------------------------------------------------
// The bard page (C5.1).
// ---------------------------------------------------------------------------

/** Each kind of person, as their page's meta line says it. */
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
 * What kind of other name a person's alias is. \`redirect\` aliases are
 * search aids, never shown; a public legal name is just their name.
 */
export const PERSON_ALIAS_KIND_LABELS: Readonly<
  Record<Exclude<PersonAliasKind, "redirect">, string>
> = {
  legal: "Name",
  sca: "SCA name",
  stage: "Stage name",
  nickname: "Nickname",
  former: "Former name",
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
  author: "Writings",
  choreography: "Choreography",
  music: "Music",
  arrangement: "Arrangements",
  translation: "Translations",
};

/**
 * Each relation between persons, read from this person's side (as
 * PIECE_RELATION_LABELS): "Member of" a group, its "Members".
 */
export const PERSON_RELATION_LABELS: Readonly<
  Record<PersonRelationType, Readonly<Record<RelationDirection, string>>>
> = {
  member_of: { outgoing: "Member of", incoming: "Members" },
  heir_of: { outgoing: "Heir of", incoming: "Heirs" },
  same_as: { outgoing: "Also recorded as", incoming: "Also recorded as" },
};
