import { describe, expect, it } from "vitest";
import type { TermListItem } from "~/schemas/catalogue";
import { buildTermIndex, isPieceTerm } from "./term-index";

const term = (
  slug: string,
  facet: TermListItem["facet"],
  parent: string | null = null
): TermListItem => ({
  slug,
  facet,
  name: slug,
  display_name: slug,
  parent_slug: parent,
  piece_count: 1,
  person_count: 0,
});

const index = buildTermIndex([
  term("war", "topic"),
  term("swords", "topic", "war"),
  term("broadswords", "topic", "swords"),
  term("orphan", "topic", "gone"),
  term("northmarch", "affiliation"),
]);

describe("buildTermIndex", () => {
  it("gives each term its depth, an unlisted parent making a root, in tree order by facet", () => {
    expect(index.bySlug.get("broadswords")?.depth).toBe(2);
    expect(index.bySlug.get("orphan")?.depth).toBe(0);
    expect(index.byFacet.get("topic")?.map(n => n.slug)).toEqual([
      "war",
      "swords",
      "broadswords",
      "orphan",
    ]);
  });
});

describe("isPieceTerm", () => {
  it.each([
    ["broadswords", true],
    ["northmarch", false],
    ["no-such-term", false],
  ])("%s is %s", (slug, expected) => {
    expect(isPieceTerm(index, slug)).toBe(expected);
  });
});
