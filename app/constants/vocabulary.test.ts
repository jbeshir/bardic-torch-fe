import { describe, expect, it } from "vitest";
import {
  CONSERVATION_LABELS,
  CONSERVATION_STATUSES,
  PIECE_KIND_LABELS,
} from "~/constants/vocabulary";
import { conservationStatusSchema, pieceKindSchema } from "~/schemas/catalogue";

describe("conservation vocabulary", () => {
  it("lists exactly the statuses that have a label (the labels are typed against the generated schema)", () => {
    expect([...CONSERVATION_STATUSES].sort()).toEqual(
      Object.keys(CONSERVATION_LABELS).sort()
    );
  });

  it("lists each status once", () => {
    expect(new Set(CONSERVATION_STATUSES).size).toBe(
      CONSERVATION_STATUSES.length
    );
  });
});

describe("piece kind vocabulary", () => {
  it("labels every kind the API has, in sentence case", () => {
    expect(Object.keys(PIECE_KIND_LABELS)).toEqual(pieceKindSchema.options);
    for (const label of Object.values(PIECE_KIND_LABELS)) {
      expect(label).toMatch(/^[A-Z][a-z ]+$/);
    }
  });

  it("orders the conservation statuses the API's way in the schema, the help page's way here", () => {
    expect([...conservationStatusSchema.options].sort()).toEqual(
      [...CONSERVATION_STATUSES].sort()
    );
  });
});
