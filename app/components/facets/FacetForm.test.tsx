import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import { facetGroups } from "~/catalogue/facet-groups";
import { pieceQuery } from "~/catalogue/query-state";
import { buildTermIndex } from "~/catalogue/term-index";
import type { PieceFacets, TermListItem } from "~/schemas/catalogue";
import { renderOnServer, renderRoutes } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
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
  {
    termsFailed = false,
    autoSubmit = false,
    apply = true,
    focusRef = createRef<string | null>() as RefObject<string | null>,
  } = {}
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
      focusRef={focusRef}
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
  it("is a GET form to /pieces with a fieldset per facet, the page state and Apply", async () => {
    await renderOnPage("");
    const element = document.getElementById("facets");
    expect(element).toHaveAttribute("method", "get");
    expect(element).toHaveAttribute("action", "/pieces");
    expect(
      screen
        .getAllByRole("group")
        .map(group => group.querySelector("legend")?.textContent)
    ).toEqual(["Kind", "Mood", "Conservation status", "Page state"]);
    expect(
      screen.getByRole("button", { name: "Apply filters" })
    ).toHaveAttribute("type", "submit");
  });

  it("ticks the state's values and chooses its page state", async () => {
    await renderOnPage("?term=warlike&kind=song&status=endangered&stub=false");
    expect(screen.getByRole("checkbox", { name: /^Warlike/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /^Eerie/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /^Song/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /^Endangered/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Hide stubs" })).toBeChecked();
  });

  it("chooses All pages with no page state; it sends an empty stub", async () => {
    await renderOnPage("");
    const all = screen.getByRole("radio", { name: "All pages" });
    expect(all).toBeChecked();
    expect(all).toHaveAttribute("value", "");
    const group = screen.getByRole("group", { name: "Page state" });
    expect(
      within(group)
        .getAllByRole("radio")
        .map(radio => radio.getAttribute("value"))
    ).toEqual(["", "true", "false"]);
  });

  it("carries the search and the letter only when set, and never the page", async () => {
    await renderOnPage("?q=kettle&letter=K&sort=title&page=3");
    expect(hidden()).toEqual([
      ["q", "kettle"],
      ["letter", "K"],
    ]);
  });

  it("has no hidden inputs with neither set", async () => {
    await renderOnPage("?kind=song&page=2");
    expect(hidden()).toEqual([]);
  });

  it("says when the categories couldn't be loaded, keeping the other filters", async () => {
    await renderOnPage("", { termsFailed: true });
    expect(screen.getByText("We couldn’t load the categories")).toBeVisible();
    expect(screen.queryByRole("group", { name: "Mood" })).toBeNull();
    expect(screen.getByRole("group", { name: "Kind" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
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

  it("remembers the control focused last", async () => {
    const focusRef = createRef<string | null>() as RefObject<string | null>;
    await renderOnPage("", { focusRef });
    screen.getByRole("checkbox", { name: /^Eerie/ }).focus();
    expect(focusRef.current).toBe("term=eerie");
  });

  it("works without JS: the server render is the plain GET form", async () => {
    const page = document.createElement("div");
    page.innerHTML = await renderOnServer(form("?term=warlike"), "/pieces");
    const element = page.querySelector("form");
    expect(element).toHaveAttribute("method", "get");
    expect(element).toHaveAttribute("action", "/pieces");
    expect(
      page.querySelector<HTMLInputElement>('input[value="warlike"]')
    ).toHaveAttribute("checked");
    expect(page.querySelector('button[type="submit"]')).toHaveTextContent(
      "Apply filters"
    );
  });

  it("has the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderOnPage("?term=warlike&stub=true")
    );
  });
});
