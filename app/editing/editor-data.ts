import type { EntityType } from "./documents";

const READ_PATHS: Readonly<Record<EntityType, string>> = {
  piece: "/pieces",
  person: "/bards",
  term: "/categories",
  collection: "/collections",
  event: "/events",
};

/** An entity's Read page, by its slug (a collection by its id). */
export const readPath = (type: EntityType, key: string | number) =>
  `${READ_PATHS[type]}/${key}`;
