import { describe, expect, it } from "vitest";
import type { Revision } from "~/schemas/catalogue";
import { revisionHead } from "./revision-head";

// The head `/revisions/:id` shows: the entity's section, noun, title and
// path for each entity type, the credit, and nothing from the snapshots.

const META = {
  id: 1013,
  base_revision_id: 1012,
  source: "user",
  summary: "Described it",
  author: { display_name: "Morwen of the Marches" },
  contributors: [],
  created_at: "2026-03-12T12:00:00Z",
} as const;

const EVENT: Revision = {
  entity_type: "event",
  entity: { slug: "muster-field", name: "Muster Field", kind: "venue" },
  ...META,
  snapshot: {
    name: "Muster Field",
    kind: "venue",
    description_md: "https://private.example/secret",
  },
  base_snapshot: null,
  changed_fields: ["description_md"],
};

describe("revisionHead", () => {
  it("is the head alone, without the snapshots", () => {
    expect(revisionHead(EVENT)).toEqual({
      id: 1013,
      baseRevisionId: 1012,
      createdAt: "2026-03-12T12:00:00Z",
      summary: "Described it",
      credit: "Morwen of the Marches",
      entity: {
        section: { label: "Events and venues", to: "/events" },
        noun: "venue",
        title: "Muster Field",
        path: "/events/muster-field",
      },
    });
    expect(JSON.stringify(revisionHead(EVENT))).not.toContain("private");
  });

  it("calls an event an event", () => {
    expect(
      revisionHead({
        ...EVENT,
        entity: { ...EVENT.entity, kind: "event" },
      } as Revision).entity.noun
    ).toBe("event");
  });

  it.each([
    [
      "piece",
      {
        slug: "the-copper-kettle",
        title: "The Copper Kettle",
        kind: "song",
        secondary_kinds: [],
        conservation_status: "endangered",
        is_stub: false,
      },
      { label: "Pieces", to: "/pieces" },
      "piece",
      "The Copper Kettle",
      "/pieces/the-copper-kettle",
    ],
    [
      "person",
      {
        slug: "wren-of-the-vale",
        name: "Wren of the Vale",
        kind: "individual",
        is_stub: false,
      },
      { label: "Bards", to: "/bards" },
      "bard",
      "Wren of the Vale",
      "/bards/wren-of-the-vale",
    ],
    [
      "term",
      { slug: "war", facet: "topic", display_name: "War" },
      { label: "Categories", to: "/categories" },
      "category",
      "War",
      "/categories/war",
    ],
    [
      "collection",
      { id: 12, name: "The Songbook" },
      { label: "Collections", to: "/collections" },
      "collection",
      "The Songbook",
      "/collections/12",
    ],
  ] as const)(
    "names a %s revision's entity",
    (entityType, entity, section, noun, title, path) => {
      const revision = {
        ...EVENT,
        entity_type: entityType,
        entity,
      } as unknown as Revision;
      expect(revisionHead(revision).entity).toEqual({
        section,
        noun,
        title,
        path,
      });
    }
  );
});
