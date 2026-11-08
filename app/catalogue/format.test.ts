import { afterEach, describe, expect, it } from "vitest";
import { formatCount, formatDate, formatNumber } from "./format";

describe("formatDate", () => {
  const zone = process.env["TZ"];
  afterEach(() => {
    process.env["TZ"] = zone;
  });

  it.each([
    ["2026-10-03T09:00:00Z", "3 Oct 2026"],
    ["2026-09-01T00:00:00Z", "1 Sep 2026"],
    ["2026-01-31T23:59:59Z", "31 Jan 2026"],
    ["2026-10-31", "31 Oct 2026"],
    // The UTC day, whatever the offset the timestamp was written with.
    ["2026-12-31T23:30:00-02:00", "1 Jan 2027"],
  ])("formats %s as %s", (timestamp, expected) => {
    expect(formatDate(timestamp)).toBe(expected);
  });

  it("gives the UTC day whatever the machine's time zone", () => {
    process.env["TZ"] = "Pacific/Auckland";
    // 11:30 the next morning in Auckland.
    expect(formatDate("2026-10-03T23:30:00Z")).toBe("3 Oct 2026");
  });
});

describe("formatNumber", () => {
  it.each([
    [0, "0"],
    [1, "1"],
    [1205, "1,205"],
    [10050, "10,050"],
  ])("formats %d as %s", (n, expected) => {
    expect(formatNumber(n)).toBe(expected);
  });
});

describe("formatCount", () => {
  it.each([
    [0, "0 pieces"],
    [1, "1 piece"],
    [2, "2 pieces"],
    [10050, "10,050 pieces"],
  ])("counts %d as %s", (n, expected) => {
    expect(formatCount(n, "piece")).toBe(expected);
  });

  it("takes an irregular plural", () => {
    expect(formatCount(1, "person or group", "people and groups")).toBe(
      "1 person or group"
    );
    expect(formatCount(61, "person or group", "people and groups")).toBe(
      "61 people and groups"
    );
  });
});
