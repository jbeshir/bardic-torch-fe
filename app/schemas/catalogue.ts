import { z } from "zod";
import type { components, operations } from "~/api/schema.gen";
import type { Assert, DeepReadonly, Matches } from "./contract";

/**
 * Runtime schemas for the catalogue's response bodies, each checked at
 * compile time against the generated spec types in both directions. The
 * spec's objects are closed, so every object here is strict: a field the
 * spec doesn't declare is a contract break (502), not data to pass on.
 *
 * The enum tuples are exported in the spec's order, which is the order the
 * API lists facet counts in and the order the URL state sorts values in
 * (`app/catalogue/query-state.ts`); read them as `schema.options`.
 * Schemas are added with the first loader that parses them.
 */

type Schemas = components["schemas"];

export const pieceKindSchema = z.enum([
  "song",
  "poem",
  "story",
  "dance_music",
  "instrumental",
  "comedy",
]);

export const conservationStatusSchema = z.enum([
  "unassessed",
  "low_risk",
  "endangered",
  "critically_endangered",
  "restricted",
]);

export const pieceSortSchema = z.enum(["title", "relevance"]);

export const letterSchema = z.enum([
  "0",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
]);

/** A count the API lists: only values with at least one match appear. */
const countSchema = z.int().min(1);

const pieceSummarySchema = z.strictObject({
  slug: z.string(),
  title: z.string(),
  kind: pieceKindSchema,
  secondary_kinds: z.array(pieceKindSchema),
  conservation_status: conservationStatusSchema,
  is_stub: z.boolean(),
});

const pieceFacetsSchema = z.strictObject({
  terms: z.array(z.strictObject({ slug: z.string(), count: countSchema })),
  kinds: z.array(z.strictObject({ kind: pieceKindSchema, count: countSchema })),
  conservation_statuses: z.array(
    z.strictObject({
      conservation_status: conservationStatusSchema,
      count: countSchema,
    })
  ),
  letters: z.array(
    z.strictObject({ letter: letterSchema, count: countSchema })
  ),
});

export const pieceListSchema = z.strictObject({
  data: z.array(pieceSummarySchema),
  total: z.int().min(0),
  facets: pieceFacetsSchema,
});

/** An operation's query object, as the generated types have it. */
export type ApiQuery<Id extends keyof operations> = DeepReadonly<
  NonNullable<operations[Id]["parameters"]["query"]>
>;

export type ConservationStatus = z.output<typeof conservationStatusSchema>;
export type Letter = z.output<typeof letterSchema>;
export type PieceKind = z.output<typeof pieceKindSchema>;
export type PieceSort = z.output<typeof pieceSortSchema>;
export type PieceSummary = DeepReadonly<z.output<typeof pieceSummarySchema>>;
export type PieceList = DeepReadonly<z.output<typeof pieceListSchema>>;

// Compile-time contract checks: each schema's output must equal the generated
// type in both directions (see `Matches`).
type _ContractChecks = [
  Assert<Matches<typeof pieceKindSchema, Schemas["PieceKind"]>>,
  Assert<
    Matches<typeof conservationStatusSchema, Schemas["ConservationStatus"]>
  >,
  Assert<Matches<typeof pieceSortSchema, Schemas["PieceSort"]>>,
  Assert<Matches<typeof letterSchema, Schemas["Letter"]>>,
  Assert<Matches<typeof pieceSummarySchema, Schemas["PieceSummary"]>>,
  Assert<Matches<typeof pieceFacetsSchema, Schemas["PieceFacets"]>>,
  Assert<Matches<typeof pieceListSchema, Schemas["PieceList"]>>,
];
