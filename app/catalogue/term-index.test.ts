import { describe, expect, it } from "vitest";
import type { TermListItem } from "~/schemas/catalogue";
import { buildTermIndex } from "./term-index";

function term(
  slug: string,
  facet: TermListItem["facet"],
  parent_slug: string | null = null
): TermListItem {
  return {
    slug,
    facet,
    name: slug,
    display_name: slug,
    parent_slug,
    piece_count: 1,
    person_count: 0,
  };
}

describe("buildTermIndex (plan §2.3)", () => {
  const index = buildTermIndex([
    term("warlike", "mood"),
    term("war", "topic"),
    term("battles", "topic", "war"),
    term("swords", "topic", "battles"),
    term("love", "topic"),
    term("northmarch", "affiliation"),
    term("ashdown", "affiliation", "northmarch"),
  ]);

  it("keeps each facet's terms in the API's tree order", () => {
    expect(index.byFacet.get("topic")?.map(t => t.slug)).toEqual([
      "war",
      "battles",
      "swords",
      "love",
    ]);
    expect(index.byFacet.get("mood")?.map(t => t.slug)).toEqual(["warlike"]);
    expect(index.byFacet.has("form")).toBe(false);
  });

  it("gives each term its depth from the parent chain", () => {
    expect(
      index.byFacet.get("topic")?.map(t => [t.slug, t.depth] as const)
    ).toEqual([
      ["war", 0],
      ["battles", 1],
      ["swords", 2],
      ["love", 0],
    ]);
    expect(index.bySlug.get("ashdown")?.depth).toBe(1);
  });

  it("takes a term whose parent isn't listed as a root", () => {
    const orphan = buildTermIndex([term("squires", "topic", "unlisted")]);
    expect(orphan.bySlug.get("squires")?.depth).toBe(0);
  });
});
