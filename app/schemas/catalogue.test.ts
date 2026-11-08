import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  conservationStatusSchema,
  facetSchema,
  letterSchema,
  pieceKindSchema,
  pieceListSchema,
  pieceSortSchema,
  termListSchema,
  termSchema,
} from "./catalogue";

// Type equality with the generated contract is asserted at compile time in
// catalogue.ts; these tests cover what types can't: the enum order the URL
// state and the facet lists rely on, and the runtime strictness.

const schemas = (
  parse(readFileSync("api/openapi.yaml", "utf8")) as {
    components: { schemas: Record<string, { enum?: string[] }> };
  }
).components.schemas;

const piece = {
  slug: "the-copper-kettle",
  title: "The Copper Kettle",
  kind: "song",
  secondary_kinds: ["dance_music"],
  conservation_status: "endangered",
  is_stub: false,
};

const list = {
  data: [piece],
  total: 1,
  facets: {
    terms: [{ slug: "war", count: 1 }],
    kinds: [{ kind: "song", count: 1 }],
    conservation_statuses: [{ conservation_status: "endangered", count: 1 }],
    letters: [{ letter: "C", count: 1 }],
  },
};

describe("enum order", () => {
  it.each([
    ["PieceKind", pieceKindSchema.options],
    ["ConservationStatus", conservationStatusSchema.options],
    ["PieceSort", pieceSortSchema.options],
    ["Letter", letterSchema.options],
  ] as const)("%s is in the spec's order", (name, options) => {
    expect(options).toEqual(schemas[name]?.enum);
  });
});

describe("pieceListSchema", () => {
  it("reads the spec's example", () => {
    expect(pieceListSchema.parse(list)).toEqual(list);
  });

  it("refuses a field the spec doesn't declare", () => {
    expect(
      pieceListSchema.safeParse({ ...list, data: [{ ...piece, url: "x" }] })
        .success
    ).toBe(false);
    expect(pieceListSchema.safeParse({ ...list, next: 2 }).success).toBe(false);
  });

  it("refuses a count of zero (only counts above zero are listed)", () => {
    expect(
      pieceListSchema.safeParse({
        ...list,
        facets: { ...list.facets, letters: [{ letter: "C", count: 0 }] },
      }).success
    ).toBe(false);
  });

  it("refuses an unknown kind, status or letter", () => {
    expect(
      pieceListSchema.safeParse({ ...list, data: [{ ...piece, kind: "x" }] })
        .success
    ).toBe(false);
    expect(
      pieceListSchema.safeParse({
        ...list,
        data: [{ ...piece, conservation_status: "lost" }],
      }).success
    ).toBe(false);
    expect(
      pieceListSchema.safeParse({
        ...list,
        facets: { ...list.facets, letters: [{ letter: "a", count: 1 }] },
      }).success
    ).toBe(false);
  });

  it("refuses a negative or fractional total", () => {
    expect(pieceListSchema.safeParse({ ...list, total: -1 }).success).toBe(
      false
    );
    expect(pieceListSchema.safeParse({ ...list, total: 1.5 }).success).toBe(
      false
    );
  });
});

// ---------------------------------------------------------------------------
// Track C

describe("terms", () => {
  const item = {
    slug: "battles",
    facet: "topic",
    name: "Battles",
    display_name: "Battles",
    parent_slug: "war",
    piece_count: 3,
    person_count: 0,
  };
  const summary = { slug: "war", facet: "topic", display_name: "War" };
  const term = {
    slug: "battles",
    facet: "topic",
    name: "Battles",
    display_name: "Battles",
    description_md: null,
    aliases: ["Fights"],
    ancestors: [summary],
    children: [
      {
        term: { slug: "swords", facet: "topic", display_name: "Swords" },
        piece_count: 2,
        person_count: 0,
      },
    ],
    related_affiliation: null,
    piece_count: 3,
    person_count: 0,
    pieces: [piece],
    persons: [
      {
        slug: "wren-of-the-vale",
        name: "Wren of the Vale",
        kind: "community_bard",
        is_stub: false,
      },
    ],
  };

  it("lists the facets in the spec's order", () => {
    expect(facetSchema.options).toEqual(schemas.Facet?.enum);
  });

  it("reads a term list and a term, with counts of 0", () => {
    const empty = { ...item, piece_count: 0 };
    expect(termListSchema.parse({ data: [item, empty] })).toEqual({
      data: [item, empty],
    });
    expect(termSchema.parse(term)).toEqual(term);
  });

  it("refuses a field the spec doesn't declare, and an unknown person kind", () => {
    expect(
      termListSchema.safeParse({ data: [{ ...item, depth: 1 }] }).success
    ).toBe(false);
    expect(
      termSchema.safeParse({
        ...term,
        persons: [{ ...term.persons[0], kind: "bard" }],
      }).success
    ).toBe(false);
  });
});
