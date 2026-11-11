import { describe, expect, it } from "vitest";
import type { TermListItem } from "~/schemas/catalogue";
import { searchTerms } from "./term-search";

const term = (
  slug: string,
  facet: TermListItem["facet"],
  display: string,
  name = display
): TermListItem => ({
  slug,
  facet,
  name,
  display_name: display,
  parent_slug: null,
  piece_count: 1,
  person_count: 0,
});

const TERMS = [
  term("warlike", "mood", "Warlike"),
  term("eerie", "mood", "Eerie"),
  term("middle-english", "language", "Middle English"),
  term("thorvald-saga", "legendaria", "Þorvald’s saga"),
  term("sea", "topic", "The sea"),
  term("story-other", "other", "Story", "Story (Tale)"),
  term("encyclopaedia", "other", "Encyclopædia"),
];

const slugs = (q: string) =>
  searchTerms(TERMS, q).shown.map(found => found.slug);

describe("searchTerms", () => {
  it.each([
    ["warl", ["warlike"]],
    ["MIDD", ["middle-english"]],
    ["middle engl", ["middle-english"]],
    ["Þorv", ["thorvald-saga"]],
    ["thorv", ["thorvald-saga"]],
    ["encyclopae", ["encyclopaedia"]],
    ["éerie", ["eerie"]],
    ["like", []],
    ["middle warl", []],
    ["tale", ["story-other"]],
    ["mood", ["warlike", "eerie"]],
    ["eerie mood", ["eerie"]],
    ["the sea", ["sea"]],
    ["th", ["thorvald-saga", "sea"]],
    ["  ", []],
  ])("%s", (q, expected) => {
    expect(slugs(q)).toEqual(expected);
  });

  it("shows the first 12 matches and counts them all", () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      term(`ballad-${i}`, "form", `Ballad ${i}`)
    );
    const found = searchTerms(many, "ballad");
    expect([found.total, found.shown.length]).toEqual([15, 12]);
  });
});
