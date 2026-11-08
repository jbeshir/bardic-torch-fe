import { describe, expect, it } from "vitest";
import { tokenInSentence, tokenLabel } from "./format";

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

describe("an empty name", () => {
  it("counts as no name, in a label and mid-sentence alike", () => {
    const token = { name: "", prefix: "9c1e7d3b" };
    expect(tokenLabel(token)).toBe("Token 9c1e7d3b…");
    expect(tokenInSentence(token)).toBe("token 9c1e7d3b…");
  });
});
