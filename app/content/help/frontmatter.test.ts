import { describe, expect, it } from "vitest";
import { helpFrontmatterSchema } from "./frontmatter";

const VALID = {
  title: "Conservation status",
  description: "How Bardic Torch flags works at risk of being lost.",
  summary: "Some works survive in only one or two places.",
  sourcePages: ["Conservation Status", "Main Page"],
  lastReviewed: "2026-10-31",
};

describe("helpFrontmatterSchema", () => {
  it("accepts a page's front matter, and an index with no source pages", () => {
    expect(helpFrontmatterSchema.parse(VALID)).toEqual(VALID);
    expect(
      helpFrontmatterSchema.safeParse({ ...VALID, sourcePages: [] }).success
    ).toBe(true);
  });

  it("allows a description of 160 characters, not 161", () => {
    const at = (length: number) =>
      helpFrontmatterSchema.safeParse({
        ...VALID,
        description: "x".repeat(length),
      }).success;
    expect(at(160)).toBe(true);
    expect(at(161)).toBe(false);
  });

  it.each([
    ["title", { title: undefined }],
    ["an empty title", { title: "  " }],
    ["description", { description: undefined }],
    ["summary", { summary: undefined }],
    ["sourcePages", { sourcePages: undefined }],
    ["a source page as a string", { sourcePages: "Main Page" }],
    ["an empty source page", { sourcePages: [""] }],
    ["lastReviewed", { lastReviewed: undefined }],
    ["a date in another form", { lastReviewed: "31/10/2026" }],
    ["an impossible date", { lastReviewed: "2026-13-45" }],
    ["a YAML date object", { lastReviewed: new Date("2026-10-31") }],
    ["an unknown key", { author: "Someone" }],
  ])("rejects front matter with %s missing or wrong", (_, change) => {
    expect(
      helpFrontmatterSchema.safeParse({ ...VALID, ...change }).success
    ).toBe(false);
  });
});
