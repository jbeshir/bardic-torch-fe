import { afterEach, describe, expect, it } from "vitest";
import { formatCatalogueSize, formatCount, formatDate } from "./format";

describe("formatDate", () => {
  const zone = process.env["TZ"];
  afterEach(() => {
    process.env["TZ"] = zone;
  });

  it.each([
    ["2026-10-03T09:00:00Z", "3 Oct 2026"],
    ["2026-10-31", "31 Oct 2026"],
    // The UTC day, whatever the offset the timestamp was written with.
    ["2026-12-31T23:30:00-02:00", "1 Jan 2027"],
  ])("formats %s as %s", (timestamp, expected) => {
    expect(formatDate(timestamp)).toBe(expected);
  });

  it("gives the UTC day whatever the machine's time zone", () => {
    process.env["TZ"] = "Pacific/Auckland";
    expect(formatDate("2026-10-03T23:30:00Z")).toBe("3 Oct 2026");
  });
});

describe("counts", () => {
  it("pluralises and groups thousands", () => {
    expect(formatCount(1, "piece")).toBe("1 piece");
    expect(formatCount(10050, "piece")).toBe("10,050 pieces");
    expect(formatCount(61, "person or group", "people and groups")).toBe(
      "61 people and groups"
    );
    expect(formatCatalogueSize(1, 1)).toBe(
      "1 piece and 1 person or group so far"
    );
  });
});
