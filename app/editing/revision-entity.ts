import type { RevisionListItem } from "~/schemas/api";
import { readPath } from "./editor-data";

/** Each entity type as the lists of revisions name it. */
export const ENTITY_NOUNS: Readonly<
  Record<RevisionListItem["entity_type"], string>
> = {
  piece: "piece",
  person: "bard",
  term: "category",
  collection: "collection",
  event: "event",
};

/**
 * What a listed revision is of: its page's name and address, or "New
 * piece" (and no address) for a new entity's.
 */
export function revisionEntity({ entity, entity_type }: RevisionListItem) {
  const noun = ENTITY_NOUNS[entity_type];
  return entity
    ? {
        name: entity.name,
        noun,
        path: readPath(entity_type, entity.slug ?? entity.collection_id ?? ""),
      }
    : { name: `New ${noun}`, noun, path: null };
}
