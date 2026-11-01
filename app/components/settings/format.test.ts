import { describe, expect, it } from "vitest";
import { formatDate, tokenInSentence, tokenLabel } from "./format";

describe("tokenLabel", () => {
  it("is the token's own name", () => {
    expect(tokenLabel({ name: "Laptop MCP", prefix: "4f2a9c1e" })).toBe(
      "Laptop MCP"
    );
  });

  it("falls back to the prefix for an unnamed token", () => {
    expect(tokenLabel({ name: null, prefix: "9c1e7d3b" })).toBe(
      "Token 9c1e7d3b…"
    );
  });
});

describe("tokenInSentence", () => {
  it("quotes the token's own name", () => {
    expect(tokenInSentence({ name: "Laptop MCP", prefix: "4f2a9c1e" })).toBe(
      "‘Laptop MCP’"
    );
  });

  it("calls an unnamed token by its prefix, in lower case mid-sentence", () => {
    expect(tokenInSentence({ name: null, prefix: "9c1e7d3b" })).toBe(
      "token 9c1e7d3b…"
    );
  });
});

describe("formatDate", () => {
  it.each([
    ["2026-10-03T09:00:00Z", "3 Oct 2026"],
    ["2026-09-01T00:00:00Z", "1 Sep 2026"],
    ["2026-01-31T23:59:59Z", "31 Jan 2026"],
    // The UTC day, whatever the offset the timestamp was written with.
    ["2026-12-31T23:30:00-02:00", "1 Jan 2027"],
  ])("formats %s as %s", (timestamp, expected) => {
    expect(formatDate(timestamp)).toBe(expected);
  });
});
