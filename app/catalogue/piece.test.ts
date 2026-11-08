import { describe, expect, it } from "vitest";
import { formatPeriod, pieceSubtitle, restrictionStatement } from "./piece";

describe("formatPeriod", () => {
  it.each([
    [1580, 1600, "1580–1600"],
    [1588, 1588, "1588"],
    [1580, null, "from 1580"],
    [null, 1600, "until 1600"],
    [null, null, null],
  ] as const)("%s to %s is %s", (start, end, label) => {
    expect(formatPeriod(start, end)).toBe(label);
  });
});

describe("pieceSubtitle", () => {
  it("is the kind, the secondary kinds and the period", () => {
    expect(
      pieceSubtitle({
        kind: "song",
        secondary_kinds: ["dance_music"],
        period_start: 1580,
        period_end: 1600,
      })
    ).toBe("Song · Dance music · 1580–1600");
  });

  it("is the kind alone when that is all there is", () => {
    expect(
      pieceSubtitle({
        kind: "poem",
        secondary_kinds: [],
        period_start: null,
        period_end: null,
      })
    ).toBe("Poem");
  });
});

describe("restrictionStatement", () => {
  const change = (
    conservation_status: "restricted" | "endangered",
    source_url: string | null
  ) => ({ conservation_status, reason: "", source_url, at: "2026-01-01" });

  it("is the newest restriction's source", () => {
    expect(
      restrictionStatement([
        change("restricted", "https://example.org/old"),
        change("endangered", "https://example.org/assessment"),
        change("restricted", "https://example.org/new"),
      ])
    ).toBe("https://example.org/new");
  });

  it("is null when the newest restriction has no source, or there is none", () => {
    expect(
      restrictionStatement([
        change("restricted", "https://example.org/old"),
        change("restricted", null),
      ])
    ).toBeNull();
    expect(
      restrictionStatement([change("endangered", "https://example.org/a")])
    ).toBeNull();
  });
});
