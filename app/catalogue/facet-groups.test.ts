import { describe, expect, it } from "vitest";
import type { PieceFacets, TermListItem } from "~/schemas/catalogue";
import { facetGroups, termChipLabel } from "./facet-groups";
import { buildTermIndex } from "./term-index";

const term = (
  slug: string,
  facet: TermListItem["facet"],
  display = slug,
  parent: string | null = null,
  pieces = 1
): TermListItem => ({
  slug,
  facet,
  name: display,
  display_name: display,
  parent_slug: parent,
  piece_count: pieces,
  person_count: 0,
});

const index = buildTermIndex([
  term("warlike", "mood", "Warlike"),
  term("eerie", "mood", "Eerie"),
  term("unused-mood", "mood", "unused-mood", null, 0),
  term("war", "topic", "War"),
  term("swords", "topic", "Swords", "war"),
  term("northmarch", "affiliation", "Northmarch"),
]);

const NOTHING = { term: [], kind: [], status: [] } as const;

const facets = (terms: PieceFacets["terms"] = []): PieceFacets => ({
  terms: terms.length
    ? terms
    : [
        { slug: "eerie", count: 4 },
        { slug: "swords", count: 2 },
        { slug: "war", count: 7 },
        { slug: "warlike", count: 31 },
      ],
  kinds: [{ kind: "song", count: 40 }],
  conservation_statuses: [{ conservation_status: "endangered", count: 5 }],
  letters: [],
});

describe("facetGroups", () => {
  it("orders Kind, the term facets, then Conservation status; terms in tree order with depths", () => {
    const groups = facetGroups(index, facets(), NOTHING);
    expect(groups.map(g => g.key)).toEqual(["kind", "mood", "topic", "status"]);
    expect(groups[1]?.shown.map(o => [o.value, o.count])).toEqual([
      ["warlike", 31],
      ["eerie", 4],
    ]);
    expect(groups[2]?.shown.map(o => [o.value, o.depth])).toEqual([
      ["war", 0],
      ["swords", 1],
    ]);
  });

  it("never lists an affiliation or an unused term, unless ticked", () => {
    const values = (selected: string[]) =>
      facetGroups(index, facets(), { ...NOTHING, term: selected }).flatMap(g =>
        g.shown.map(o => o.value)
      );
    expect(values([])).not.toContain("unused-mood");
    expect(values([])).not.toContain("northmarch");
    expect(values(["unused-mood"])).toContain("unused-mood");
  });

  it("disables an option nothing would match, unless it is ticked", () => {
    const only = facets([{ slug: "warlike", count: 2 }]);
    const eerie = (term: string[]) =>
      facetGroups(index, only, { ...NOTHING, term })[1]?.shown.find(
        o => o.value === "eerie"
      );
    expect(eerie([])).toMatchObject({ count: 0, disabled: true });
    expect(eerie(["eerie"])).toMatchObject({ disabled: false, selected: true });
  });

  it("shows the first 8 of a long group and every ticked one; the rest are behind Show all", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      term(`topic-${String(i).padStart(2, "0")}`, "topic")
    );
    const groups = facetGroups(buildTermIndex(many), facets(), {
      ...NOTHING,
      term: ["topic-10"],
    });
    const topic = groups.find(g => g.key === "topic");
    expect(topic?.shown).toHaveLength(9);
    expect(topic?.shown.at(-1)?.value).toBe("topic-10");
    expect(topic?.more.map(o => o.value)).toEqual([
      "topic-08",
      "topic-09",
      "topic-11",
    ]);
  });

  it("has only Kind and Conservation status without the terms", () => {
    expect(facetGroups(null, facets(), NOTHING).map(g => g.key)).toEqual([
      "kind",
      "status",
    ]);
  });
});

describe("termChipLabel", () => {
  it("names a term by facet and display name, else falls back to the slug", () => {
    expect(termChipLabel(index, "warlike")).toBe("Mood: Warlike");
    expect(termChipLabel(null, "warlike")).toBe("Category: warlike");
    expect(termChipLabel(index, "gone")).toBe("Category: gone");
  });
});
