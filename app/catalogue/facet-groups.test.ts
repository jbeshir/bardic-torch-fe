import { describe, expect, it } from "vitest";
import type { PieceFacets, TermListItem } from "~/schemas/catalogue";
import { facetGroups, termChipLabel } from "./facet-groups";
import { buildTermIndex } from "./term-index";

function term(
  slug: string,
  facet: TermListItem["facet"],
  {
    parent = null,
    name,
    display = name ?? slug,
    pieces = 1,
  }: {
    readonly parent?: string | null;
    readonly name?: string;
    readonly display?: string;
    readonly pieces?: number;
  } = {}
): TermListItem {
  return {
    slug,
    facet,
    name: name ?? display,
    display_name: display,
    parent_slug: parent,
    piece_count: pieces,
    person_count: 0,
  };
}

const TERMS = [
  term("warlike", "mood", { display: "Warlike" }),
  term("eerie", "mood", { display: "Eerie" }),
  term("unused-mood", "mood", { pieces: 0 }),
  term("war", "topic", { display: "War" }),
  term("swords", "topic", { parent: "war", display: "Swords" }),
  term("story-mood", "other", { name: "Story (Other)", display: "Story" }),
  term("story-other", "other", { name: "Story (Tale)", display: "Story" }),
  term("northmarch", "affiliation", { display: "Northmarch" }),
];

const NOTHING = { term: [], kind: [], status: [] } as const;

function facets(overrides: Partial<PieceFacets> = {}): PieceFacets {
  return {
    terms: [
      { slug: "eerie", count: 4 },
      { slug: "swords", count: 2 },
      { slug: "war", count: 7 },
      { slug: "warlike", count: 31 },
    ],
    kinds: [
      { kind: "song", count: 40 },
      { kind: "poem", count: 3 },
    ],
    conservation_statuses: [{ conservation_status: "endangered", count: 5 }],
    letters: [],
    ...overrides,
  };
}

const index = buildTermIndex(TERMS);

describe("facetGroups", () => {
  it("orders the groups Kind, the term facets in the API's order, then Conservation status", () => {
    const groups = facetGroups(index, facets(), NOTHING);
    expect(groups.map(group => group.key)).toEqual([
      "kind",
      "mood",
      "topic",
      "other",
      "status",
    ]);
    expect(groups.map(group => group.legend)).toEqual([
      "Kind",
      "Mood",
      "Topic",
      "Other",
      "Conservation status",
    ]);
    expect(groups.map(group => group.name)).toEqual([
      "kind",
      "term",
      "term",
      "term",
      "status",
    ]);
  });

  it("joins the counts to the terms, in tree order with depths", () => {
    const [, mood, topic] = facetGroups(index, facets(), NOTHING);
    expect(mood?.shown.map(o => [o.value, o.label, o.count])).toEqual([
      ["warlike", "Warlike", 31],
      ["eerie", "Eerie", 4],
    ]);
    expect(topic?.shown.map(o => [o.value, o.depth])).toEqual([
      ["war", 0],
      ["swords", 1],
    ]);
  });

  it("lists only the terms that classify any piece, and never an affiliation", () => {
    const groups = facetGroups(index, facets(), NOTHING);
    const values = groups.flatMap(group => group.shown.map(o => o.value));
    expect(values).not.toContain("unused-mood");
    expect(values).not.toContain("northmarch");
  });

  it("greys and disables an option nothing would match, unless it is ticked", () => {
    const [, mood] = facetGroups(
      index,
      facets({ terms: [{ slug: "warlike", count: 2 }] }),
      NOTHING
    );
    expect(mood?.shown.find(o => o.value === "eerie")).toMatchObject({
      count: 0,
      disabled: true,
      selected: false,
    });
    const [, ticked] = facetGroups(
      index,
      facets({ terms: [{ slug: "warlike", count: 2 }] }),
      { ...NOTHING, term: ["eerie"] }
    );
    expect(ticked?.shown.find(o => o.value === "eerie")).toMatchObject({
      count: 0,
      disabled: false,
      selected: true,
    });
  });

  it("keeps the children of a ticked term listed", () => {
    const [, , topic] = facetGroups(index, facets(), {
      ...NOTHING,
      term: ["war"],
    });
    expect(topic?.shown.map(o => [o.value, o.selected])).toEqual([
      ["war", true],
      ["swords", false],
    ]);
  });

  it("shows the full names of two options with one display name", () => {
    const groups = facetGroups(index, facets(), NOTHING);
    const other = groups.find(group => group.key === "other");
    expect(other?.shown.map(o => o.label)).toEqual([
      "Story (Other)",
      "Story (Tale)",
    ]);
  });

  it("lists every kind and status, greyed at 0, in enum order", () => {
    const groups = facetGroups(index, facets(), {
      ...NOTHING,
      kind: ["comedy"],
    });
    const kinds = groups[0];
    expect(kinds?.shown.map(o => [o.label, o.count, o.disabled])).toEqual([
      ["Song", 40, false],
      ["Poem", 3, false],
      ["Story", 0, true],
      ["Dance music", 0, true],
      ["Instrumental", 0, true],
      ["Comedy", 0, false],
    ]);
    const statuses = groups.at(-1);
    expect(statuses?.shown.map(o => [o.value, o.label, o.count])).toEqual([
      ["unassessed", "Not yet assessed", 0],
      ["low_risk", "Low risk", 0],
      ["endangered", "Endangered", 5],
      ["critically_endangered", "Critically endangered", 0],
      ["restricted", "Restricted", 0],
    ]);
  });

  it("ignores a counted slug the terms don't know", () => {
    const groups = facetGroups(
      index,
      facets({ terms: [{ slug: "approved-since", count: 3 }] }),
      NOTHING
    );
    expect(
      groups.flatMap(group => group.shown.map(o => o.value))
    ).not.toContain("approved-since");
  });

  it("shows the first 8 of a long group and every ticked one, the rest behind Show all", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      term(`topic-${String(i).padStart(2, "0")}`, "topic")
    );
    const groups = facetGroups(buildTermIndex(many), facets({ terms: [] }), {
      ...NOTHING,
      term: ["topic-10"],
    });
    const topic = groups.find(group => group.key === "topic");
    expect(topic?.shown.map(o => o.value)).toEqual([
      "topic-00",
      "topic-01",
      "topic-02",
      "topic-03",
      "topic-04",
      "topic-05",
      "topic-06",
      "topic-07",
      "topic-10",
    ]);
    expect(topic?.more.map(o => o.value)).toEqual([
      "topic-08",
      "topic-09",
      "topic-11",
    ]);
  });

  it("has only Kind and Conservation status without the terms", () => {
    expect(
      facetGroups(null, facets(), NOTHING).map(group => group.key)
    ).toEqual(["kind", "status"]);
  });
});

describe("termChipLabel", () => {
  it("names a term by its facet and display name", () => {
    expect(termChipLabel(index, "warlike")).toBe("Mood: Warlike");
    expect(termChipLabel(index, "story-mood")).toBe("Other: Story");
  });

  it("falls back to the slug without the terms", () => {
    expect(termChipLabel(null, "warlike")).toBe("Category: warlike");
    expect(termChipLabel(index, "gone")).toBe("Category: gone");
  });
});
