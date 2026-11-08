import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { buildTermIndex } from "~/catalogue/term-index";
import type { TermListItem } from "~/schemas/catalogue";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { TermTree } from "./TermTree";

function term(
  slug: string,
  display_name: string,
  overrides: Partial<TermListItem> = {}
): TermListItem {
  return {
    slug,
    facet: "topic",
    name: display_name,
    display_name,
    parent_slug: null,
    piece_count: 3,
    person_count: 0,
    ...overrides,
  };
}

const TOPICS = [
  term("war", "War", { piece_count: 31 }),
  term("battles", "Battles", { parent_slug: "war" }),
  term("swords", "Swords", { parent_slug: "battles", piece_count: 1 }),
  term("sieges", "Sieges", { parent_slug: "war", piece_count: 0 }),
  term("love", "Love"),
];

function terms(list: readonly TermListItem[], facet = "topic" as const) {
  return buildTermIndex(list).byFacet.get(list[0]?.facet ?? facet) ?? [];
}

describe("TermTree", () => {
  it("nests each term's children under it, in tree order", async () => {
    await renderWithRouter(<TermTree terms={terms(TOPICS)} />);
    const [top] = screen.getAllByRole("list");
    if (!top) throw new Error("no list");
    const roots = within(top)
      .getAllByRole("listitem")
      .filter(item => item.parentElement === top);
    expect(roots.map(item => item.firstElementChild?.textContent)).toEqual([
      "War(31)31 pieces",
      "Love(3)3 pieces",
    ]);
    const war = roots[0];
    if (!war) throw new Error("no War");
    const battles = within(war).getByRole("link", { name: "Battles" });
    const swords = within(war).getByRole("link", { name: "Swords" });
    // Swords sits in Battles' own list, inside War's.
    expect(swords.closest("ul")?.closest("li")).toBe(battles.closest("li"));
    expect(
      within(war).getByRole("link", { name: "Sieges" }).closest("ul")
    ).toBe(battles.closest("ul"));
  });

  it("links each term to its page, with its count read in words", async () => {
    await renderWithRouter(<TermTree terms={terms(TOPICS)} />);
    expect(screen.getByRole("link", { name: "War" })).toHaveAttribute(
      "href",
      "/categories/war"
    );
    expect(screen.getByText("(31)")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("31 pieces")).toHaveClass("sr-only");
    expect(screen.getByText("1 piece")).toBeInTheDocument();
    expect(screen.getByText("0 pieces")).toBeInTheDocument();
  });

  it("counts an affiliation's bards", async () => {
    await renderWithRouter(
      <TermTree
        terms={terms([
          term("northmarch", "Northmarch", {
            facet: "affiliation",
            piece_count: 0,
            person_count: 4,
          }),
        ])}
      />
    );
    expect(screen.getByText("4 bards")).toBeInTheDocument();
  });

  it("shows the full name where two terms of the facet share a display name", async () => {
    await renderWithRouter(
      <TermTree
        terms={terms([
          term("sca", "SCA", { name: "SCA (Topic)" }),
          term("sca-two", "SCA", {
            name: "SCA (Contrafacta)",
            parent_slug: "sca",
          }),
          term("love", "Love"),
        ])}
      />
    );
    expect(screen.getByRole("link", { name: "SCA (Topic)" })).toBeVisible();
    expect(
      screen.getByRole("link", { name: "SCA (Contrafacta)" })
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Love" })).toBeVisible();
  });

  it("is a list of plain links in tab order", async () => {
    await renderWithRouter(<TermTree terms={terms(TOPICS)} />);
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole("link", { name: "War" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Battles" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Swords" })).toHaveFocus();
  });

  it("renders the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(<TermTree terms={terms(TOPICS)} />)
    );
  });
});
