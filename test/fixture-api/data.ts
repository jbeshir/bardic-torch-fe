import type { components } from "../../app/api/schema.gen";

/**
 * Seed data for the fixture API. Names are invented stage names.
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
