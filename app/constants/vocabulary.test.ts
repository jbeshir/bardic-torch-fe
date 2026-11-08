import { describe, expect, it } from "vitest";
import {
  CONSERVATION_LABELS,
  CONSERVATION_STATUSES,
} from "~/constants/vocabulary";

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
