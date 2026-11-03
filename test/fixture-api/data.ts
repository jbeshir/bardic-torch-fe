import type { components } from "../../app/api/schema.gen";

/**
 * Seed data for the fixture API. Names are invented stage names; every
 * fixture user gets its own copy of the sample tokens.
 */

type Schemas = components["schemas"];

export type SeedUserId = "contributor" | "moderator";

export const SEED_USERS: Readonly<
  Record<SeedUserId, Readonly<Schemas["User"]>>
> = {
  contributor: {
    id: "fixture|contributor",
    display_name: "Morwen of the Marches",
    role: "contributor",
  },
  moderator: {
    id: "fixture|moderator",
    display_name: "Master Tobias Fiddler",
    role: "moderator",
  },
};

/** Active tokens, oldest first: named and used, unnamed, never used. */
export const SAMPLE_TOKENS: readonly Readonly<Schemas["APIToken"]>[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    prefix: "4f2a9c1e",
    name: "Laptop scripts",
    created_at: "2026-08-15T12:00:00Z",
    last_used_at: "2026-10-20T08:30:00Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    prefix: "9c1e7d3b",
    name: null,
    created_at: "2026-09-01T10:00:00Z",
    last_used_at: "2026-09-02T17:45:00Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    prefix: "7d3b5a6f",
    name: "Songbook importer",
    created_at: "2026-10-01T09:00:00Z",
    last_used_at: null,
  },
];
