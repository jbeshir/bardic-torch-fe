import type { Person } from "~/schemas/catalogue";

/** Catalogue data for component tests; every name is an invented stage name. */

const WREN = {
  slug: "wren-of-the-vale",
  name: "Wren of the Vale",
  kind: "community_bard",
  is_stub: false,
} as const;

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
