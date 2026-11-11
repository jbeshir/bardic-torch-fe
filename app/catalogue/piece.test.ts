import { describe, expect, it } from "vitest";
import { formatPeriod, restrictionStatement } from "./piece";

describe("formatPeriod", () => {
  it.each([
    [1580, 1600, "1580–1600"],
    [1588, 1588, "1588"],
    [1580, null, "from 1580"],
    [null, null, null],
  ] as const)("%s to %s is %s", (start, end, label) => {
    expect(formatPeriod(start, end)).toBe(label);
  });
});

describe("restrictionStatement", () => {
  const change = (
    conservation_status: "restricted" | "endangered",
    source_url: string | null
  ) => ({ conservation_status, reason: "", source_url, at: "2026-01-01" });

  it("is the newest restriction's source, else null", () => {
    expect(
      restrictionStatement([
        change("restricted", "https://example.org/old"),
        change("endangered", "https://example.org/a"),
        change("restricted", "https://example.org/new"),
      ])
    ).toBe("https://example.org/new");
    expect(
      restrictionStatement([
        change("restricted", "https://example.org/old"),
        change("restricted", null),
      ])
    ).toBeNull();
  });
});
