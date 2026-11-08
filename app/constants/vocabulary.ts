import type {
  ConservationStatus,
  Facet,
  Letter,
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
// Facets (C2.2)

/** Each facet's label, in sentence case: the facet column's legends. */
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

// ---------------------------------------------------------------------------
// Persons (C3.1)

/** Each person kind's label, in sentence case. */
export const PERSON_KIND_LABELS: Readonly<Record<PersonKind, string>> = {
  community_bard: "Community bard",
  historical: "Historical figure",
  group: "Group",
};
