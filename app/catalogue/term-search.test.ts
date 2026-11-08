import { describe, expect, it } from "vitest";
import type { TermListItem } from "~/schemas/catalogue";
import { searchTerms } from "./term-search";

function term(
  slug: string,
  facet: TermListItem["facet"],
  display: string,
  name = display
): TermListItem {
  return {
    slug,
    facet,
    name,
    display_name: display,
    parent_slug: null,
    piece_count: 1,
    person_count: 0,
  };
}

const TERMS = [
  term("warlike", "mood", "Warlike"),
  term("eerie", "mood", "Eerie"),
  term("middle-english", "language", "Middle English"),
  term("thorvald-saga", "legendaria", "Þorvald’s saga"),
  term("sea", "topic", "The sea"),
  term("story-mood", "mood", "Story", "Story (Mood)"),
  term("encyclopaedia", "other", "Encyclopædia"),
  term("northmarch", "affiliation", "Northmarch"),
];

const slugs = (q: string) =>
  searchTerms(TERMS, q).shown.map(found => found.slug);

describe("searchTerms", () => {
  it.each([
    ["warl", ["warlike"]],
    ["engl", ["middle-english"]],
    ["MIDD", ["middle-english"]],
    ["middle engl", ["middle-english"]],
    ["thorv", ["thorvald-saga"]],
    ["Þorv", ["thorvald-saga"]],
    ["encyclopae", ["encyclopaedia"]],
    ["éerie", ["eerie"]],
    ["north", ["northmarch"]],
  ])("matches %s at the start of a word", (q, expected) => {
    expect(slugs(q)).toEqual(expected);
  });

  it("doesn't match inside a word", () => {
    expect(slugs("like")).toEqual([]);
    expect(slugs("glish")).toEqual([]);
  });

  it("needs every word to match", () => {
    expect(slugs("middle warl")).toEqual([]);
  });

  it("matches the facet label, in tree order", () => {
    expect(slugs("mood")).toEqual(["warlike", "eerie", "story-mood"]);
    expect(slugs("eerie mood")).toEqual(["eerie"]);
  });

  it("matches the full name with its disambiguation", () => {
    expect(
      searchTerms(
        [term("story-other", "other", "Story", "Story (Tale)")],
        "tale"
      ).total
    ).toBe(1);
  });

  it("ignores stopwords and short words, falling back to a prefix of the name", () => {
    expect(slugs("the sea")).toEqual(["sea"]);
    expect(slugs("th")).toEqual(["thorvald-saga", "sea"]);
    expect(slugs("ee")).toEqual(["eerie"]);
    expect(slugs("  ")).toEqual([]);
  });

  it("shows the first 12 matches and counts them all", () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      term(`ballad-${i}`, "form", `Ballad ${i}`)
    );
    const found = searchTerms(many, "ballad");
    expect(found.total).toBe(15);
    expect(found.shown).toHaveLength(12);
    expect(found.shown[0]?.slug).toBe("ballad-0");
  });
});
