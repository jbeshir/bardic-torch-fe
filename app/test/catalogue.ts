import type { Person, Piece } from "~/schemas/catalogue";

/**
 * Catalogue data for component tests: a piece with nothing recorded but
 * what the API always sends, and the parts tests vary. Every name is an
 * invented stage name.
 */

type Credit = Piece["credits"][number];
type PieceTerm = Piece["terms"][number];

export const WREN = {
  slug: "wren-of-the-vale",
  name: "Wren of the Vale",
  kind: "community_bard",
  is_stub: false,
} as const;

/** A piece called "The Copper Kettle" with `overrides`. */
export function pieceOf(overrides: Partial<Piece> = {}): Piece {
  return {
    slug: "the-copper-kettle",
    title: "The Copper Kettle",
    kind: "song",
    secondary_kinds: [],
    conservation_status: "endangered",
    is_stub: false,
    notes_md: null,
    version_notes_md: null,
    licensing_status: "unknown",
    licensing_notes_md: null,
    licence: null,
    historical_source_md: null,
    period_start: null,
    period_end: null,
    aliases: [],
    terms: [],
    credits: [],
    relations: [],
    links: [],
    conservation_history: [],
    ...overrides,
  };
}

/** A certain credit to Wren, or with no person to `attribution`. */
export function creditOf(overrides: Partial<Credit> = {}): Credit {
  return {
    role: "lyrics",
    attribution: "named",
    certainty: "certain",
    part: null,
    note: null,
    person: WREN,
    ...overrides,
  };
}

/** A piece's term. */
export function termOf(
  slug: string,
  facet: PieceTerm["term"]["facet"],
  displayName: string,
  { is_primary = false, part = null }: Partial<PieceTerm> = {}
): PieceTerm {
  return {
    term: { slug, facet, display_name: displayName },
    is_primary,
    part,
  };
}

type PieceLink = Piece["links"][number];

/** A piece's link with nothing recorded about it but its address. */
export function linkOf(overrides: Partial<PieceLink> = {}): PieceLink {
  return {
    url: "https://example.org/kettle",
    title: null,
    description: null,
    platform: null,
    place_type: null,
    collection: null,
    locator: null,
    liveness: "unknown",
    last_checked_at: null,
    archived_url: null,
    roles: ["other"],
    performances: [],
    ...overrides,
  };
}

type Performance = PieceLink["performances"][number];

/** A performance recorded on a link. */
export function performanceOf(
  overrides: Partial<Performance> = {}
): Performance {
  return {
    year: 2025,
    uploader: null,
    description_verbatim: "Sung by the fire",
    event: null,
    performers: [],
    ...overrides,
  };
}

type Profile = NonNullable<Person["profile"]>;

/** A profile with nothing recorded, and `overrides`. */
export function profileOf(overrides: Partial<Profile> = {}): Profile {
  return {
    pronouns: null,
    notes_md: null,
    licensing_status: "unknown",
    licensing_notes_md: null,
    aliases: [],
    roles: [],
    affiliations: [],
    relations: [],
    links: [],
    works: [],
    works_total: 0,
    performances: [],
    performances_total: 0,
    ...overrides,
  };
}

/** Wren of the Vale, an active community bard with a page, and `overrides`. */
export function personOf(overrides: Partial<Person> = {}): Person {
  return {
    ...WREN,
    status: "active",
    status_date: null,
    status_source_url: null,
    profile: profileOf(),
    ...overrides,
  };
}

/** A piece as other entities refer to it. */
export function pieceSummaryOf(
  slug: string,
  title: string,
  conservation_status: Piece["conservation_status"] = "low_risk"
): Piece["relations"][number]["piece"] {
  return {
    slug,
    title,
    kind: "song",
    secondary_kinds: [],
    conservation_status,
    is_stub: false,
  };
}
