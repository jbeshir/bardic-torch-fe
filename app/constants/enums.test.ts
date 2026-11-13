import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  COLLECTION_KINDS,
  CONSERVATION_STATUS_VALUES,
  CREDIT_ROLES,
  FACETS,
  LETTERS,
  LINK_ROLES,
  PERSON_KINDS,
  PERSON_ROLES,
  PERSON_SORTS,
  PIECE_KINDS,
  PIECE_SORTS,
} from "./enums";

// The zod-free enum values the browser reads, each exactly the spec's
// values in the spec's order: the URL state sorts by it and the facet
// lists follow it.

const schemas = (
  parse(readFileSync("api/openapi.yaml", "utf8")) as {
    components: { schemas: Record<string, { enum?: string[] }> };
  }
).components.schemas;

describe("enum values", () => {
  it.each([
    ["PieceKind", PIECE_KINDS],
    ["ConservationStatus", CONSERVATION_STATUS_VALUES],
    ["PieceSort", PIECE_SORTS],
    ["Letter", LETTERS],
    ["Facet", FACETS],
    ["PersonKind", PERSON_KINDS],
    ["CreditRole", CREDIT_ROLES],
    ["PersonRole", PERSON_ROLES],
    ["LinkRole", LINK_ROLES],
    ["PersonSort", PERSON_SORTS],
    ["CollectionKind", COLLECTION_KINDS],
  ] as const)("%s is the spec's, in its order", (name, values) => {
    expect(values).toEqual(schemas[name]?.enum);
  });
});
