import { describe, expect, it } from "vitest";
import type { Revision } from "~/schemas/catalogue";
import { revisionHead } from "./revision-head";

const EVENT: Revision = {
  entity_type: "event",
  entity: { slug: "muster-field", name: "Muster Field" },
  id: 1013,
  base_revision_id: 1012,
  source: "user",
  summary: "Renamed it",
  author: { display_name: "Morwen of the Marches" },
  contributors: [],
  created_at: "2026-03-12T12:00:00Z",
  snapshot: { name: "Muster Field" },
  base_snapshot: { name: "The private muster ground" },
  changed_fields: ["name"],
};

describe("revisionHead", () => {
  it("is the head alone, without the snapshots", () => {
    expect(revisionHead(EVENT)).toEqual({
      id: 1013,
      baseRevisionId: 1012,
      createdAt: "2026-03-12T12:00:00Z",
      summary: "Renamed it",
      credit: "Morwen of the Marches",
      entity: {
        section: { label: "Events", to: "/events" },
        noun: "event",
        title: "Muster Field",
        path: "/events/muster-field",
      },
    });
    expect(JSON.stringify(revisionHead(EVENT))).not.toContain("private");
  });

  it.each([
    [
      "person",
      { slug: "wren-of-the-vale", name: "Wren of the Vale" },
      "Bards",
      "/bards/wren-of-the-vale",
    ],
    [
      "term",
      { slug: "war", facet: "topic", display_name: "War" },
      "Categories",
      "/categories/war",
    ],
  ] as const)("names a %s revision's entity", (type, entity, label, path) => {
    const head = revisionHead({
      ...EVENT,
      entity_type: type,
      entity,
    } as unknown as Revision);
    expect(head.entity).toMatchObject({ section: { label }, path });
  });
});
