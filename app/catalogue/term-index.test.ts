import { describe, expect, it } from "vitest";
import type { TermListItem } from "~/schemas/catalogue";
import { buildTermIndex, isPieceTerm } from "./term-index";

function term(
  slug: string,
  facet: TermListItem["facet"],
  parent: string | null = null
): TermListItem {
  return {
    slug,
    facet,
    name: slug,
    display_name: slug,
    parent_slug: parent,
    piece_count: 1,
    person_count: 0,
  };
}

const TREE = [
  term("warlike", "mood"),
  term("war", "topic"),
  term("swords", "topic", "war"),
  term("broadswords", "topic", "swords"),
  term("sea", "topic"),
  term("northmarch", "affiliation"),
];

describe("buildTermIndex", () => {
  it("finds each term by slug, with its depth from the parent chain", () => {
    const index = buildTermIndex(TREE);
    expect(index.bySlug.get("war")?.depth).toBe(0);
    expect(index.bySlug.get("swords")?.depth).toBe(1);
    expect(index.bySlug.get("broadswords")?.depth).toBe(2);
    expect(index.bySlug.get("swords")?.facet).toBe("topic");
    expect(index.bySlug.has("nothing")).toBe(false);
  });

  it("groups each facet's terms in the tree order it was given", () => {
    const index = buildTermIndex(TREE);
    expect(index.byFacet.get("topic")?.map(node => node.slug)).toEqual([
      "war",
      "swords",
      "broadswords",
      "sea",
    ]);
    expect(index.byFacet.get("mood")?.map(node => node.slug)).toEqual([
      "warlike",
    ]);
    expect(index.byFacet.has("culture")).toBe(false);
  });

  it("takes a term whose parent isn't listed as a root", () => {
    const index = buildTermIndex([term("orphan", "topic", "gone")]);
    expect(index.bySlug.get("orphan")?.depth).toBe(0);
  });

  it("is empty for no terms", () => {
    const index = buildTermIndex([]);
    expect(index.bySlug.size).toBe(0);
    expect(index.byFacet.size).toBe(0);
  });
});

describe("isPieceTerm", () => {
  const index = buildTermIndex(TREE);

  it.each(["warlike", "war", "broadswords"])("takes %s", slug => {
    expect(isPieceTerm(index, slug)).toBe(true);
  });

  it("refuses an affiliation, which classifies persons", () => {
    expect(isPieceTerm(index, "northmarch")).toBe(false);
  });

  it("refuses a slug the terms don't have", () => {
    expect(isPieceTerm(index, "no-such-term")).toBe(false);
  });
});
