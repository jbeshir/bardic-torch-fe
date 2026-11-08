import { describe, expect, it } from "vitest";
import { linkExposure } from "./restricted";

describe("linkExposure", () => {
  it.each([
    ["unassessed", "full"],
    ["low_risk", "full"],
    ["endangered", "full"],
    ["critically_endangered", "full"],
    ["restricted", "internal-only"],
  ] as const)("shows a %s piece's links %s", (status, exposure) => {
    expect(linkExposure({ conservation_status: status })).toBe(exposure);
  });
});
