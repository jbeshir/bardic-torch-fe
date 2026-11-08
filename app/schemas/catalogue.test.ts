import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  conservationStatusSchema,
  facetSchema,
  letterSchema,
  personListSchema,
  pieceKindSchema,
  pieceListSchema,
  pieceSortSchema,
  termListSchema,
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
// C2.2 terms and C3.1 persons

describe("facetSchema", () => {
  it("is in the spec's order", () => {
    expect(facetSchema.options).toEqual(schemas.Facet?.enum);
  });
});

describe("termListSchema", () => {
  const term = {
    slug: "swords",
    facet: "topic",
    name: "Swords",
    display_name: "Swords",
    parent_slug: "war",
    piece_count: 4,
    person_count: 0,
  };

  it("reads a term list, a root's parent null", () => {
    const terms = { data: [{ ...term, slug: "war", parent_slug: null }, term] };
    expect(termListSchema.parse(terms)).toEqual(terms);
  });

  it("refuses a field the spec doesn't declare, and a negative count", () => {
    expect(
      termListSchema.safeParse({ data: [{ ...term, depth: 1 }] }).success
    ).toBe(false);
    expect(
      termListSchema.safeParse({ data: [{ ...term, piece_count: -1 }] }).success
    ).toBe(false);
  });
});

describe("personListSchema", () => {
  const persons = {
    data: [
      {
        slug: "wren-of-the-vale",
        name: "Wren of the Vale",
        kind: "community_bard",
        is_stub: false,
      },
    ],
    total: 1,
    letters: [{ letter: "W", count: 1 }],
  };

  it("reads the spec's example", () => {
    expect(personListSchema.parse(persons)).toEqual(persons);
  });

  it("refuses an unknown kind and a zero letter count", () => {
    expect(
      personListSchema.safeParse({
        ...persons,
        data: [{ ...persons.data[0], kind: "bard" }],
      }).success
    ).toBe(false);
    expect(
      personListSchema.safeParse({
        ...persons,
        letters: [{ letter: "W", count: 0 }],
      }).success
    ).toBe(false);
  });
});
