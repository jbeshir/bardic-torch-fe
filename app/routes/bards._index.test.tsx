import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { data } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { personQuery } from "~/catalogue/query-state";
import type { PersonList, PersonSummary, TermList } from "~/schemas/catalogue";
import { renderRoutes } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import BardsRoute, { ErrorBoundary } from "./bards._index";

// The /bards page in the browser, from stubbed loader data: every state of
// the list and its filters. The loader is bards._index.ssr.test.ts's.

const person = (
  slug: string,
  name: string,
  overrides: Partial<PersonSummary> = {}
): PersonSummary => ({
  slug,
  name,
  kind: "community_bard",
  is_stub: false,
  ...overrides,
});

const PEOPLE = [
  person("wren-of-the-vale", "Wren of the Vale"),
  person("wynne-of-caer-wyn", "Wynne of Caer Wyn", { is_stub: true }),
  person("northmarch-bards", "Northmarch Bards", { kind: "group" }),
];

const listOf = (
  people: readonly PersonSummary[],
  total = people.length
): PersonList => ({
  data: people,
  total,
  letters: [
    { letter: "N", count: 1 },
    { letter: "W", count: 2 },
  ],
});

const term = (slug: string, name: string, parent: string | null = null) => ({
  slug,
  facet: "affiliation" as const,
  name,
  display_name: name,
  parent_slug: parent,
  piece_count: 0,
  person_count: 1,
});

const AFFILIATIONS: TermList["data"] = [
  term("northmarch", "Northmarch"),
  term("barony-of-ashdown", "Barony of Ashdown", "northmarch"),
  term("caer-wyn", "Caer Wyn"),
];

function loaded(
  search: string,
  list: PersonList,
  extra: {
    affiliations?: TermList["data"] | null;
    staleAffiliation?: boolean;
  } = {}
) {
  const { state, canonical } = personQuery.parse(new URLSearchParams(search));
  return () => ({
    state,
    canonical,
    affiliations:
      extra.affiliations === undefined ? AFFILIATIONS : extra.affiliations,
    failure: null,
    list,
    staleAffiliation: extra.staleAffiliation ?? false,
  });
}

function renderBards(search: string, answer: (url: URL) => unknown) {
  return renderRoutes(
    [
      {
        path: "/bards",
        loader: ({ request }) => answer(new URL(request.url)),
        Component: BardsRoute,
        ErrorBoundary,
        HydrateFallback: () => null,
      },
    ],
    `/bards${search}`
  );
}

/** Each request answered from its own URL's state. */
const byUrl = (list: PersonList) => (url: URL) => loaded(url.search, list)();

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/bards page", () => {
  it("lists the bards under the head, with the count, the A–Z and the filters", async () => {
    await renderBards("", byUrl(listOf(PEOPLE, 14)));
    expect(
      screen.getByRole("heading", { level: 1, name: "Bards" })
    ).toBeVisible();
    expect(screen.getByText("14 bards")).toBeVisible();
    const results = screen.getByRole("region", { name: "All bards" });
    const rows = within(results).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Wren of the ValeCommunity bard");
    expect(rows[1]).toHaveTextContent("Wynne of Caer WynCommunity bardStub");
    expect(rows[2]).toHaveTextContent("Northmarch BardsGroup");
    expect(
      within(results).getByRole("link", { name: "Wren of the Vale" })
    ).toHaveAttribute("href", "/bards/wren-of-the-vale");
    const bar = screen.getByRole("navigation", { name: "Bards by letter" });
    expect(within(bar).getByText("All")).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(bar).getByRole("link", { name: "W" })).toHaveAttribute(
      "href",
      "/bards?letter=W"
    );
    expect(screen.getByRole("status")).toHaveTextContent("Showing 14 bards");
    // The filters come after the results, closed.
    const filters = screen.getByText("Filters").closest("details");
    expect(filters).not.toHaveAttribute("open");
    expect(
      results.compareDocumentPosition(filters as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("lists the affiliations in tree order, indented, and checks the state's values", async () => {
    await renderBards(
      "?kind=group&role=singer&affiliation=barony-of-ashdown",
      byUrl(listOf(PEOPLE))
    );
    expect(screen.getByRole("checkbox", { name: "Group" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Community bard" })
    ).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Singer" })).toBeChecked();
    const select = screen.getByRole("combobox", { name: "Affiliation" });
    expect(
      within(select)
        .getAllByRole("option")
        .map(option => option.textContent)
    ).toEqual([
      "Any affiliation",
      "Northmarch",
      "— Barony of Ashdown",
      "Caer Wyn",
    ]);
    expect(select).toHaveValue("barony-of-ashdown");
  });

  it("names each selected value in a chip that removes it", async () => {
    await renderBards(
      "?q=wren&kind=group&role=poet&affiliation=northmarch&letter=W",
      byUrl(listOf(PEOPLE))
    );
    const chips = screen.getByRole("region", { name: "Selected filters" });
    for (const [label, href] of [
      [
        "Search: ‘wren’",
        "/bards?kind=group&role=poet&affiliation=northmarch&letter=W",
      ],
      [
        "Kind: Group",
        "/bards?q=wren&role=poet&affiliation=northmarch&letter=W",
      ],
      [
        "Role: Poet",
        "/bards?q=wren&kind=group&affiliation=northmarch&letter=W",
      ],
      [
        "Affiliation: Northmarch",
        "/bards?q=wren&kind=group&role=poet&letter=W",
      ],
      [
        "Letter: W",
        "/bards?q=wren&kind=group&role=poet&affiliation=northmarch",
      ],
    ] as const) {
      expect(
        within(chips).getByRole("link", { name: `Remove ${label}` })
      ).toHaveAttribute("href", href);
    }
  });

  it("falls back to an affiliation's slug, and replaces the select with an error, when the terms didn't load", async () => {
    await renderBards("?affiliation=northmarch", (url: URL) =>
      loaded(url.search, listOf(PEOPLE), { affiliations: null })()
    );
    expect(
      screen.getByRole("link", { name: "Remove Affiliation: northmarch" })
    ).toBeVisible();
    expect(screen.queryByRole("combobox", { name: "Affiliation" })).toBeNull();
    expect(
      screen.getByText("We couldn’t load the affiliations")
    ).toBeInTheDocument();
    // The list still shows.
    expect(
      screen.getByRole("link", { name: "Wren of the Vale" })
    ).toBeVisible();
  });

  it("says a stale affiliation was left out", async () => {
    await renderBards("?affiliation=gone-kingdom", (url: URL) =>
      loaded(url.search, listOf(PEOPLE), { staleAffiliation: true })()
    );
    expect(
      screen.getByText("That affiliation no longer exists, so we left it out.")
    ).toBeVisible();
  });

  it("says nothing matches a search, offering to clear it", async () => {
    await renderBards("?q=zzz&kind=group", byUrl(listOf([])));
    expect(
      screen.getByRole("heading", { level: 3, name: "Nothing matches ‘zzz’" })
    ).toBeVisible();
    expect(screen.getByText("Try a shorter search.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute(
      "href",
      "/bards?kind=group"
    );
    expect(screen.getByRole("status")).toHaveTextContent("No results");
  });

  it("says no bards match the filters, offering to clear them all", async () => {
    await renderBards("?role=jester&letter=Q", byUrl(listOf([])));
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "No bards match these filters",
      })
    ).toBeVisible();
    expect(screen.getByText("Try removing a filter.")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Clear all filters" })
    ).toHaveAttribute("href", "/bards");
  });

  it("applies the filters at once at xl, and keeps the form's state the URL's", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const user = userEvent.setup();
    const router = await renderBards("", byUrl(listOf(PEOPLE)));
    // Open at xl, with JS.
    expect(screen.getByText("Filters").closest("details")).toHaveAttribute(
      "open"
    );
    await user.click(screen.getByRole("checkbox", { name: "Group" }));
    expect(router.state.location.search).toBe("?kind=group");
    // The chip takes it off again; the remounted form forgets it.
    await user.click(
      await screen.findByRole("link", { name: "Remove Kind: Group" })
    );
    expect(router.state.location.search).toBe("");
    expect(screen.getByRole("checkbox", { name: "Group" })).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Poet" }));
    expect(router.state.location.search).toBe("?role=poet");
  });

  it("applies the filters only with Apply below xl, straight to the canonical URL", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const user = userEvent.setup();
    const router = await renderBards("?q=wren", byUrl(listOf(PEOPLE)));
    await user.click(screen.getByText("Filters"));
    await user.click(screen.getByRole("checkbox", { name: "Singer" }));
    await user.click(screen.getByRole("checkbox", { name: "Group" }));
    expect(router.state.location.search).toBe("?q=wren");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Affiliation" }),
      "caer-wyn"
    );
    await user.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(router.state.location.search).toBe(
      "?q=wren&kind=group&role=singer&affiliation=caer-wyn"
    );
  });

  it("searches every letter from the search box, keeping the filters", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const user = userEvent.setup();
    const router = await renderBards(
      "?kind=group&letter=W&page=2",
      byUrl(listOf(PEOPLE, 120))
    );
    await user.type(
      screen.getByRole("searchbox", { name: "Search bards" }),
      "wren"
    );
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(router.state.location.search).toBe("?q=wren&kind=group");
  });

  it("marks the results busy while a letter loads, keeping the old ones", async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    let calls = 0;
    await renderBards("", (url: URL) => {
      calls += 1;
      if (calls === 1) return loaded(url.search, listOf(PEOPLE))();
      return new Promise(resolve => {
        release = () =>
          resolve(loaded(url.search, listOf(PEOPLE.slice(0, 1)))());
      });
    });
    const results = () => screen.getByRole("status").closest("section");
    await user.click(screen.getByRole("link", { name: "W" }));
    expect(results()).toHaveAttribute("aria-busy", "true");
    await act(async () => {
      release();
    });
    expect(results()).not.toHaveAttribute("aria-busy");
  });

  it.each([
    [{ kind: "resting", retryAfter: 60 }, 503, "Bardic Torch is resting"],
    [{ kind: "server" }, 500, "We couldn’t load the bards"],
    [{ kind: "bad_gateway" }, 502, "Something went wrong"],
  ])("shows a thrown %o as “%s”", async (failure, status, title) => {
    await renderBards("", () => {
      throw data(failure, { status });
    });
    expect(
      screen.getByRole("heading", { level: 1, name: title })
    ).toBeVisible();
  });

  it("keeps the search box and chips on a search too slow", async () => {
    await renderBards("?q=slow", (url: URL) => {
      const { state, canonical } = personQuery.parse(url.searchParams);
      return data(
        {
          state,
          canonical,
          affiliations: AFFILIATIONS,
          failure: { kind: "search_timeout" },
          list: null,
          staleAffiliation: false,
        },
        { status: 500 }
      );
    });
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "That search took too long",
      })
    ).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "Search bards" })).toHaveValue(
      "slow"
    );
  });

  it("has the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderBards("?kind=group", byUrl(listOf(PEOPLE)))
    );
  });
});
