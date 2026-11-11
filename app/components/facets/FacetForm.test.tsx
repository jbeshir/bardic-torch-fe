import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { facetGroups } from "~/catalogue/facet-groups";
import { pieceQuery } from "~/catalogue/query-state";
import { buildTermIndex } from "~/catalogue/term-index";
import type { PieceFacets, TermListItem } from "~/schemas/catalogue";
import { renderRoutes } from "~/test/router";
import { FacetForm } from "./FacetForm";

const TERMS: readonly TermListItem[] = [
  {
    slug: "warlike",
    facet: "mood",
    name: "Warlike",
    display_name: "Warlike",
    parent_slug: null,
    piece_count: 31,
    person_count: 0,
  },
  {
    slug: "eerie",
    facet: "mood",
    name: "Eerie",
    display_name: "Eerie",
    parent_slug: null,
    piece_count: 4,
    person_count: 0,
  },
];

const FACETS: PieceFacets = {
  terms: [
    { slug: "eerie", count: 4 },
    { slug: "warlike", count: 31 },
  ],
  kinds: [{ kind: "song", count: 20 }],
  conservation_statuses: [{ conservation_status: "endangered", count: 2 }],
  letters: [],
};

const stateOf = (search: string) =>
  pieceQuery.parse(new URLSearchParams(search)).state;

function form(
  search: string,
  { termsFailed = false, autoSubmit = false, apply = true } = {}
) {
  const state = stateOf(search);
  return (
    <FacetForm
      id="facets"
      state={state}
      groups={facetGroups(
        termsFailed ? null : buildTermIndex(TERMS),
        FACETS,
        state
      )}
      termsFailed={termsFailed}
      autoSubmit={autoSubmit}
      apply={apply}
    />
  );
}

/** The form on a /pieces route, to follow where it navigates. */
function renderOnPage(
  search: string,
  options: Parameters<typeof form>[1] = {}
) {
  return renderRoutes(
    [
      {
        path: "/pieces",
        element: form(search, options),
        HydrateFallback: () => null,
      },
    ],
    `/pieces${search}`
  );
}

function hidden() {
  return [
    ...document.querySelectorAll<HTMLInputElement>('input[type="hidden"]'),
  ].map(input => [input.name, input.value]);
}

describe("FacetForm", () => {
  it("carries the search and the letter only when set, and never the page", async () => {
    await renderOnPage("?q=kettle&letter=K&sort=title&page=3");
    expect(hidden()).toEqual([
      ["q", "kettle"],
      ["letter", "K"],
    ]);
  });

  it("applies the ticks with Apply, straight to the canonical URL from page 1", async () => {
    const user = userEvent.setup();
    const router = await renderOnPage("?q=kettle&letter=K&page=2");
    await user.click(screen.getByRole("checkbox", { name: /^Song/ }));
    await user.click(screen.getByRole("checkbox", { name: /^Warlike/ }));
    // Not applied until asked.
    expect(router.state.location.search).toBe("?q=kettle&letter=K&page=2");
    await user.click(screen.getByRole("radio", { name: "Stubs only" }));
    await user.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(router.state.location.search).toBe(
      "?q=kettle&term=warlike&kind=song&stub=true&letter=K"
    );
  });

  it("applies each change at once with autoSubmit, by keyboard too", async () => {
    const user = userEvent.setup();
    const router = await renderOnPage("?term=warlike", { autoSubmit: true });
    const eerie = screen.getByRole("checkbox", { name: /^Eerie/ });
    eerie.focus();
    await user.keyboard(" ");
    expect(router.state.location.search).toBe("?term=eerie&term=warlike");
  });

  it("clears the page state with All pages", async () => {
    const user = userEvent.setup();
    const router = await renderOnPage("?stub=true", { autoSubmit: true });
    await user.click(screen.getByRole("radio", { name: "All pages" }));
    expect(router.state.location.search).toBe("");
  });

  it("can leave Apply to its container", async () => {
    await renderOnPage("", { apply: false });
    expect(screen.queryByRole("button", { name: "Apply filters" })).toBeNull();
  });
});
