import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { data } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { pieceQuery } from "~/catalogue/query-state";
import type {
  PieceList,
  PieceSummary,
  TermListItem,
} from "~/schemas/catalogue";
import { renderRoutes } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import PiecesRoute, { ErrorBoundary } from "./pieces._index";

// The /pieces page in the browser, from stubbed loader data: every state of
// the list, its links and controls, and the busy results while a same-route
// navigation is pending. The loader itself is pieces._index.ssr.test.ts's.

function piece(n: number, overrides: Partial<PieceSummary> = {}): PieceSummary {
  return {
    slug: `drill-song-${n}`,
    title: `Drill Song ${n}`,
    kind: "song",
    secondary_kinds: [],
    conservation_status: "unassessed",
    is_stub: false,
    ...overrides,
  };
}

function listOf(
  pieces: readonly PieceSummary[],
  total = pieces.length
): PieceList {
  return {
    data: pieces,
    total,
    facets: {
      terms: total > 0 ? [{ slug: "warlike", count: total }] : [],
      kinds: total > 0 ? [{ kind: "song", count: total }] : [],
      conservation_statuses: [],
      letters: [
        { letter: "D", count: 205 },
        { letter: "T", count: 5 },
      ],
    },
  };
}

type Answer = () => unknown;

/** /pieces{search} with a loader answering `answer` for every request. */
function renderPieces(search: string, answer: Answer) {
  return renderRoutes(
    [
      {
        path: "/pieces",
        loader: () => answer(),
        Component: PiecesRoute,
        ErrorBoundary,
        HydrateFallback: () => null,
      },
    ],
    `/pieces${search}`
  );
}

function term(
  slug: string,
  facet: TermListItem["facet"],
  display: string
): TermListItem {
  return {
    slug,
    facet,
    name: display,
    display_name: display,
    parent_slug: null,
    piece_count: 10,
    person_count: 0,
  };
}

const TERMS = [
  term("warlike", "mood", "Warlike"),
  term("eerie", "mood", "Eerie"),
  term("sea", "topic", "The sea"),
];

/** The loader data for `search` with `list`, as the loader returns it. */
function loaded(
  search: string,
  list: PieceList,
  {
    terms = TERMS,
    stale = [],
  }: {
    readonly terms?: readonly TermListItem[] | null;
    readonly stale?: readonly string[];
  } = {}
) {
  const { state, canonical } = pieceQuery.parse(new URLSearchParams(search));
  return () => ({ state, canonical, terms, stale, failure: null, list });
}

const FIFTY = Array.from({ length: 50 }, (_, i) => piece(i + 1));

describe("/pieces page", () => {
  it("lists the pieces under the page head, with the count and the A–Z", async () => {
    await renderPieces("", loaded("", listOf(FIFTY, 249)));
    expect(
      screen.getByRole("heading", { level: 1, name: "Pieces" })
    ).toBeVisible();
    expect(screen.getByText("249 pieces")).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 2, name: "All pieces" })
    ).toBeVisible();
    const results = screen.getByRole("region", { name: "All pieces" });
    expect(
      within(results).getAllByRole("link", { name: /^Drill Song/ })
    ).toHaveLength(50);
    expect(screen.getByRole("link", { name: "Drill Song 1" })).toHaveAttribute(
      "href",
      "/pieces/drill-song-1"
    );
    const bar = screen.getByRole("navigation", { name: "Pieces by letter" });
    expect(within(bar).getByText("All")).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(bar).getByRole("link", { name: "T" })).toHaveAttribute(
      "href",
      "/pieces?letter=T"
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Showing 1–50 of 249 pieces"
    );
    // Shown under the heading too, not only said.
    expect(screen.getByRole("status")).not.toHaveClass("sr-only");
    expect(screen.getByRole("status")).toHaveClass("text-fg-muted");
    // No search, so no order to choose and no chips.
    expect(screen.queryByRole("combobox", { name: "Sort by" })).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Selected filters" })
    ).toBeNull();
  });

  it("pages the list, keeping its state", async () => {
    await renderPieces(
      "?letter=D&page=2",
      loaded("?letter=D&page=2", listOf(FIFTY, 205))
    );
    const pagination = screen.getByRole("navigation", { name: "Pagination" });
    expect(
      within(pagination).getByRole("link", { name: "Page 5" })
    ).toHaveAttribute("href", "/pieces?letter=D&page=5");
    expect(
      within(pagination).getByRole("link", { name: /Previous/ })
    ).toHaveAttribute("href", "/pieces?letter=D");
  });

  it("names the letter and offers to remove it", async () => {
    await renderPieces(
      "?letter=T",
      loaded("?letter=T", listOf([piece(1, { title: "Tavern Round" })], 1))
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Pieces under T" })
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Remove Letter: T" })
    ).toHaveAttribute("href", "/pieces");
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1 piece");
  });

  it("shows a search's order and chips", async () => {
    await renderPieces(
      "?q=kettle&letter=K",
      loaded("?q=kettle&letter=K", listOf([piece(1)], 1))
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Results for ‘kettle’" })
    ).toBeVisible();
    // Best match, the default, which the form sends empty.
    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveValue("");
    const chips = screen.getByRole("region", { name: "Selected filters" });
    expect(
      within(chips)
        .getAllByRole("link")
        .map(link => [link.textContent, link.getAttribute("href")])
    ).toEqual([
      ["Remove Search: ‘kettle’", "/pieces?letter=K"],
      ["Remove Letter: K", "/pieces?q=kettle"],
      ["Clear all", "/pieces"],
    ]);
  });

  it("says nothing matches a search, and offers to browse", async () => {
    // A search that matches nothing has no letters either (the API's
    // counts ignore only the letter filter).
    const none = listOf([], 0);
    await renderPieces(
      "?q=zzz",
      loaded("?q=zzz", { ...none, facets: { ...none.facets, letters: [] } })
    );
    expect(
      screen.getByRole("heading", { name: "Nothing matches ‘zzz’" })
    ).toBeVisible();
    expect(
      screen.getByText("Try a shorter search, or browse by mood or topic.")
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Browse pieces" })).toHaveAttribute(
      "href",
      "/pieces"
    );
    expect(screen.getByRole("status")).toHaveTextContent("No results");
    // The empty state shows it; the status only says it.
    expect(screen.getByRole("status")).toHaveClass("sr-only");
    // Nothing to put in order, so no order to choose; with no entries
    // under any letter, no letter is a link, only All (the current cell).
    expect(screen.queryByRole("combobox", { name: "Sort by" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sort" })).toBeNull();
    const bar = screen.getByRole("navigation", { name: "Pieces by letter" });
    expect(within(bar).queryAllByRole("link")).toEqual([]);
    expect(within(bar).getByText("D")).toHaveAttribute("aria-disabled", "true");
  });

  it("says no pieces match the filters, and offers to clear them", async () => {
    await renderPieces("?letter=Q", loaded("?letter=Q", listOf([], 0)));
    expect(
      screen.getByRole("heading", { name: "No pieces match these filters" })
    ).toBeVisible();
    expect(screen.getByText("Try removing a filter.")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Clear all filters" })
    ).toHaveAttribute("href", "/pieces");
    expect(screen.getByRole("status")).toHaveTextContent(
      "No pieces match these filters"
    );
    // The letters that have entries still lead somewhere; the rest are text.
    const bar = screen.getByRole("navigation", { name: "Pieces by letter" });
    expect(
      within(bar)
        .getAllByRole("link")
        .map(link => link.textContent)
    ).toEqual(["All", "D", "T"]);
    expect(within(bar).getByText("Q")).toHaveAttribute("aria-current", "page");
  });

  it("says when the catalogue has no pieces at all", async () => {
    await renderPieces("", loaded("", listOf([], 0)));
    expect(
      screen.getByRole("heading", { name: "No pieces yet" })
    ).toBeVisible();
  });

  it("keeps the search box and chips when a search was too slow", async () => {
    const { state, canonical } = pieceQuery.parse(
      new URLSearchParams("?q=slow")
    );
    await renderPieces("?q=slow", () =>
      data(
        {
          state,
          canonical,
          terms: TERMS,
          stale: [],
          failure: { kind: "search_timeout" },
          list: null,
        },
        { status: 500 }
      )
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "That search took too long",
      })
    ).toBeVisible();
    expect(
      screen.getByRole("searchbox", { name: "Search pieces" })
    ).toHaveValue("slow");
    expect(
      screen.getByRole("link", { name: "Remove Search: ‘slow’" })
    ).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Pieces" })).toBeNull();
  });

  it("offers to clear filters the API refused", async () => {
    const { state, canonical } = pieceQuery.parse(
      new URLSearchParams("?term=gone")
    );
    await renderPieces("?term=gone", () =>
      data(
        {
          state,
          canonical,
          terms: TERMS,
          stale: [],
          failure: { kind: "invalid_filters" },
          list: null,
        },
        { status: 400 }
      )
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "We couldn’t apply these filters",
      })
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Clear all filters" })
    ).toHaveAttribute("href", "/pieces");
  });

  it.each([
    [{ kind: "resting", retryAfter: 60 }, 503, "Bardic Torch is resting"],
    [{ kind: "server" }, 500, "We couldn’t load the pieces"],
    [{ kind: "bad_gateway" }, 502, "Something went wrong"],
  ] as const)(
    "shows a thrown %o in its error boundary",
    async (failure, status, title) => {
      await renderPieces("", () => {
        throw data(failure, { status });
      });
      expect(
        screen.getByRole("heading", { level: 1, name: title })
      ).toBeVisible();
    }
  );

  it("shows anything else thrown as a server error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await renderPieces("", () => {
      throw new Error("boom");
    });
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "We couldn’t load the pieces",
      })
    ).toBeVisible();
    vi.restoreAllMocks();
  });

  it("marks the results busy while a letter loads, keeping the old ones", async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    let calls = 0;
    await renderPieces("", () => {
      calls += 1;
      if (calls === 1) return loaded("", listOf(FIFTY, 249))();
      return new Promise(resolve => {
        release = () =>
          resolve(
            loaded(
              "?letter=T",
              listOf([piece(1, { title: "Tavern Round" })], 1)
            )()
          );
      });
    });
    const results = () => screen.getByRole("status").closest("section");
    expect(results()).not.toHaveAttribute("aria-busy");
    await user.click(screen.getByRole("link", { name: "T" }));
    expect(results()).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("link", { name: "Drill Song 1" })).toBeVisible();
    await act(async () => {
      release();
    });
    expect(results()).not.toHaveAttribute("aria-busy");
    expect(screen.getByRole("link", { name: "Tavern Round" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1 piece");
  });

  it("is walked with Tab: the search, the letters, Filters, the results, then the filters", async () => {
    const user = userEvent.setup();
    await renderPieces("", loaded("", listOf(FIFTY, 249)));
    // From xl, a skip link to the facet column comes first (hidden below).
    await user.tab();
    expect(screen.getByRole("link", { name: "Skip to filters" })).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("searchbox", { name: "Search pieces" })
    ).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Search" })).toHaveFocus();
    await user.tab();
    // All is the current cell, not a link; then the letters with entries
    // (only D and T here), then the results.
    expect(screen.getByRole("link", { name: "D" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "T" })).toHaveFocus();
    await user.tab();
    // Below xl, the way to the filters before the results.
    expect(screen.getByRole("button", { name: "Filters" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Drill Song 1" })).toHaveFocus();
  });

  it("is walked with Tab from xl: after the results and the pages, the facet column", async () => {
    wideScreen();
    const user = userEvent.setup();
    await renderPieces("", loaded("", listOf(FIFTY, 249)));
    screen.getByRole("link", { name: /Next/ }).focus();
    await user.tab();
    expect(screen.getByRole("checkbox", { name: /^Song/ })).toHaveFocus();
  });

  it("has the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderPieces(
        "?q=kettle",
        loaded("?q=kettle", listOf(FIFTY.slice(0, 3), 3))
      )
    );
  });
});

// ---------------------------------------------------------------------------
// C2.2: the facet column, its chips and the stale-term notice

/**
 * /pieces{search} with a loader answering each request from its own URL,
 * recording the queries it was asked for.
 */
async function renderLive(
  search: string,
  options: Parameters<typeof loaded>[2] = {}
) {
  const asked: string[] = [];
  const router = await renderRoutes(
    [
      {
        path: "/pieces",
        loader: ({ request }) => {
          const query = new URL(request.url).search;
          asked.push(query);
          return loaded(query, listOf(FIFTY.slice(0, 3), 3), options)();
        },
        Component: PiecesRoute,
        ErrorBoundary,
        HydrateFallback: () => null,
      },
    ],
    `/pieces${search}`
  );
  return { router, asked };
}

/** A screen from xl, where the facet column applies each change. */
function wideScreen() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(min-width: 1280px)",
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe("/pieces facets", () => {
  it("has the facet column after the results from xl, with its groups and counts", async () => {
    wideScreen();
    await renderLive("");
    const filters = screen.getByRole("region", { name: "Filters" });
    expect(filters).toHaveAttribute("id", "filters");
    expect(
      within(filters)
        .getAllByRole("group")
        .map(group => group.querySelector("legend")?.textContent)
    ).toEqual(["Kind", "Mood", "Topic", "Conservation status", "Page state"]);
    expect(
      within(filters).getByRole("checkbox", { name: "Warlike, 3 pieces" })
    ).toBeEnabled();
    // Listed by the terms, but nothing would match it now.
    expect(
      within(filters).getByRole("checkbox", { name: /^Eerie/ })
    ).toBeDisabled();
    // The results come first in the DOM, at every width.
    const results = screen.getByRole("region", { name: "All pieces" });
    expect(
      results.compareDocumentPosition(filters) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Skip to filters" })
    ).toHaveAttribute("href", "#filters");
  });

  it("opens the filters below xl with a button, saying how many are ticked", async () => {
    await renderLive("?term=warlike&kind=song&stub=true");
    const button = screen.getByRole("button", { name: "Filters (3 selected)" });
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button).toHaveAttribute(
      "aria-controls",
      document.querySelector("dialog")?.id
    );
    // The drawer has the only facet form: none in the page's flow.
    expect(screen.queryByRole("region", { name: "Filters" })).toBeNull();
    expect(document.querySelectorAll("#filters")).toHaveLength(0);
  });

  it("has a chip for every selected value, in the URL's order, each without it", async () => {
    await renderLive(
      "?q=kettle&term=sea&term=warlike&kind=song&status=endangered&stub=false&letter=K"
    );
    const chips = screen.getByRole("region", { name: "Selected filters" });
    expect(
      within(chips)
        .getAllByRole("link")
        .map(link => [link.textContent, link.getAttribute("href")])
    ).toEqual([
      [
        "Remove Search: ‘kettle’",
        "/pieces?term=sea&term=warlike&kind=song&status=endangered&stub=false&letter=K",
      ],
      [
        "Remove Topic: The sea",
        "/pieces?q=kettle&term=warlike&kind=song&status=endangered&stub=false&letter=K",
      ],
      [
        "Remove Mood: Warlike",
        "/pieces?q=kettle&term=sea&kind=song&status=endangered&stub=false&letter=K",
      ],
      [
        "Remove Kind: Song",
        "/pieces?q=kettle&term=sea&term=warlike&status=endangered&stub=false&letter=K",
      ],
      [
        "Remove Conservation: Endangered",
        "/pieces?q=kettle&term=sea&term=warlike&kind=song&stub=false&letter=K",
      ],
      [
        "Remove Hiding stubs",
        "/pieces?q=kettle&term=sea&term=warlike&kind=song&status=endangered&letter=K",
      ],
      [
        "Remove Letter: K",
        "/pieces?q=kettle&term=sea&term=warlike&kind=song&status=endangered&stub=false",
      ],
      ["Clear all", "/pieces"],
    ]);
    for (const link of within(chips).getAllByRole("link")) {
      expect(link).toHaveAttribute("rel", "nofollow");
    }
  });

  it("names a stubs-only chip", async () => {
    await renderLive("?stub=true");
    expect(
      screen.getByRole("link", { name: "Remove Stubs only" })
    ).toHaveAttribute("href", "/pieces");
  });

  it("keeps the results when the terms failed: chips by slug, the categories' error in the column", async () => {
    wideScreen();
    await renderLive("?term=warlike", { terms: null });
    expect(
      screen.getByRole("link", { name: "Remove Category: warlike" })
    ).toBeVisible();
    const filters = screen.getByRole("region", { name: "Filters" });
    expect(
      within(filters).getByText("We couldn’t load the categories")
    ).toBeVisible();
    expect(within(filters).getByRole("group", { name: "Kind" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Drill Song 1" })).toBeVisible();
  });

  it("says which categories of the link were left out", async () => {
    await renderLive("?term=warlike", { stale: ["old-mood", "gone"] });
    expect(
      screen.getByText(
        "Some categories in this link no longer exist, so we left them out: ‘old-mood’, ‘gone’."
      )
    ).toBeVisible();
  });

  it("applies the ticks below xl only with Show results, in one request to the canonical URL", async () => {
    const user = userEvent.setup();
    const { router, asked } = await renderLive("?letter=D&page=2");
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(screen.getByRole("checkbox", { name: /^Song/ }));
    expect(asked).toEqual(["?letter=D&page=2"]);
    await user.click(screen.getByRole("button", { name: "Show results" }));
    expect(router.state.location.search).toBe("?kind=song&letter=D");
    expect(asked).toEqual(["?letter=D&page=2", "?kind=song&letter=D"]);
  });

  it("applies each change at once from xl, keeping focus on the box", async () => {
    wideScreen();
    const user = userEvent.setup();
    const { router, asked } = await renderLive("");
    expect(
      screen.queryByRole("button", { name: "Apply filters" })
    ).toBeVisible();
    screen.getByRole("checkbox", { name: /^Song/ }).focus();
    await user.keyboard(" ");
    expect(router.state.location.search).toBe("?kind=song");
    expect(asked).toEqual(["", "?kind=song"]);
    // The form was rebuilt from the new URL; the same box has focus.
    await waitFor(() => {
      const song = screen.getByRole("checkbox", { name: /^Song/ });
      expect(song).toBeChecked();
      expect(song).toHaveFocus();
    });
  });

  it("never re-adds a value its chip removed, and Back restores the boxes", async () => {
    wideScreen();
    const user = userEvent.setup();
    const { router } = await renderLive("");
    await user.click(screen.getByRole("checkbox", { name: /^Warlike/ }));
    expect(router.state.location.search).toBe("?term=warlike");
    await user.click(
      await screen.findByRole("link", { name: "Remove Mood: Warlike" })
    );
    expect(router.state.location.search).toBe("");
    await waitFor(() => {
      expect(
        screen.queryByRole("link", { name: "Remove Mood: Warlike" })
      ).toBeNull();
    });
    expect(
      screen.getByRole("checkbox", { name: /^Warlike/ })
    ).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: /^Song/ }));
    expect(router.state.location.search).toBe("?kind=song");
    expect(
      await screen.findByRole("link", { name: "Remove Kind: Song" })
    ).toBeVisible();
    await act(async () => {
      await router.navigate(-1);
    });
    await act(async () => {
      await router.navigate(-1);
    });
    expect(router.state.location.search).toBe("?term=warlike");
    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: /^Warlike/ })).toBeChecked();
    });
    expect(screen.getByRole("checkbox", { name: /^Song/ })).not.toBeChecked();
  });

  it("puts the order in the facet form, so Apply sends it without JS", async () => {
    wideScreen();
    await renderLive("?q=kettle&sort=title");
    const select = screen.getByRole("combobox", { name: "Sort by" });
    const form = screen
      .getByRole("button", { name: "Apply filters" })
      .closest("form");
    expect(form).not.toBeNull();
    expect(select).toHaveAttribute("form", form?.id);
  });

  it("keeps the chips and says the categories failed on the filters page", async () => {
    const { state, canonical } = pieceQuery.parse(
      new URLSearchParams("?term=warlike")
    );
    await renderPieces("?term=warlike", () =>
      data(
        {
          state,
          canonical,
          terms: null,
          stale: [],
          failure: { kind: "invalid_filters" },
          list: null,
        },
        { status: 400 }
      )
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "We couldn’t apply these filters",
      })
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Remove Category: warlike" })
    ).toBeVisible();
    expect(screen.getByText("We couldn’t load the categories")).toBeVisible();
  });

  it("has the same markup in both themes with filters set", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderLive("?term=warlike&kind=song", { stale: ["gone"] })
    );
  });
});

// ---------------------------------------------------------------------------
// C2.3: the facet drawer, below xl with JS

/** Escape on the open dialog (jsdom's stand-in fires `cancel`). */
function pressEscape() {
  act(() => {
    fireEvent(
      document.querySelector("dialog[open]") as HTMLDialogElement,
      new Event("cancel", { cancelable: true })
    );
  });
}

describe("/pieces facet drawer", () => {
  it("opens from the keyboard, focus on Close, and Escape discards the unapplied ticks", async () => {
    const user = userEvent.setup();
    const { router } = await renderLive("?letter=D");
    const trigger = screen.getByRole("button", { name: "Filters" });
    trigger.focus();
    await user.keyboard("{Enter}");
    const drawer = screen.getByRole("dialog", { name: "Filter pieces" });
    expect(
      within(drawer).getAllByRole("button", { name: "Close filters" })[0]
    ).toHaveFocus();
    await user.click(within(drawer).getByRole("checkbox", { name: /^Song/ }));
    pressEscape();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
    expect(router.state.location.search).toBe("?letter=D");
    await user.click(trigger);
    expect(
      within(screen.getByRole("dialog")).getByRole("checkbox", {
        name: /^Song/,
      })
    ).not.toBeChecked();
  });

  it("shows the results on Show results: the canonical URL, the drawer closed, focus back on Filters", async () => {
    const user = userEvent.setup();
    const { router, asked } = await renderLive("?q=kettle&page=2");
    await user.click(screen.getByRole("button", { name: "Filters" }));
    const drawer = screen.getByRole("dialog", { name: "Filter pieces" });
    await user.click(
      within(drawer).getByRole("checkbox", { name: /^Warlike/ })
    );
    await user.click(within(drawer).getByRole("radio", { name: "Stubs only" }));
    await user.click(
      within(drawer).getByRole("button", { name: "Show results" })
    );
    expect(router.state.location.search).toBe(
      "?q=kettle&term=warlike&stub=true"
    );
    expect(asked).toEqual([
      "?q=kettle&page=2",
      "?q=kettle&term=warlike&stub=true",
    ]);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    const trigger = screen.getByRole("button", {
      name: "Filters (2 selected)",
    });
    expect(trigger).toHaveFocus();
    expect(
      screen.getByRole("link", { name: "Remove Mood: Warlike" })
    ).toBeVisible();
  });

  it("clears the ticked filters, keeping the search and letter", async () => {
    const user = userEvent.setup();
    await renderLive("?q=kettle&term=warlike&kind=song&letter=K");
    await user.click(screen.getByRole("button", { name: /^Filters/ }));
    expect(
      within(screen.getByRole("dialog")).getByRole("link", {
        name: "Clear all",
      })
    ).toHaveAttribute("href", "/pieces?q=kettle&letter=K");
  });

  it("leaves nothing of the drawer behind when Show results meets an outage", async () => {
    const user = userEvent.setup();
    let calls = 0;
    await renderPieces("", () => {
      calls += 1;
      if (calls === 1) return loaded("", listOf(FIFTY, 249))();
      throw data({ kind: "resting", retryAfter: 60 }, { status: 503 });
    });
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("checkbox", {
        name: /^Song/,
      })
    );
    await user.click(screen.getByRole("button", { name: "Show results" }));
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Bardic Torch is resting",
      })
    ).toBeVisible();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector("dialog")).toBeNull();
    expect(document.documentElement).not.toHaveClass("overflow-hidden");
  });

  it("has no duplicate ids with the drawer open", async () => {
    const user = userEvent.setup();
    await renderLive("?q=kettle&term=warlike");
    await user.click(screen.getByRole("button", { name: /^Filters/ }));
    const ids = [...document.querySelectorAll("[id]")].map(
      element => element.id
    );
    expect(new Set(ids).size).toBe(ids.length);
    // One facet form, the drawer's, which the order belongs to.
    const forms = document.querySelectorAll(
      'form[action="/pieces"]:not([role="search"])'
    );
    expect(forms).toHaveLength(1);
    expect(
      screen.getByRole("combobox", { name: "Sort by", hidden: true })
    ).toHaveAttribute("form", forms[0]?.id);
  });

  it("has the same markup in both themes, open", async () => {
    await expectSameMarkupInBothThemes(async () => {
      await renderLive("?term=warlike");
      await userEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    });
  });
});

describe("/pieces focus and status after the list changes in place", () => {
  it("moves focus to the results heading when the letter used becomes text", async () => {
    const user = userEvent.setup();
    const { router } = await renderLive("");
    const bar = screen.getByRole("navigation", { name: "Pieces by letter" });
    await user.click(within(bar).getByRole("link", { name: "T" }));
    expect(router.state.location.search).toBe("?letter=T");
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 2, name: "Pieces under T" })
      ).toHaveFocus();
    });
  });

  it("never pulls focus back into the facet column after a chip or a letter", async () => {
    wideScreen();
    const user = userEvent.setup();
    const { router } = await renderLive("?term=warlike");
    // A box had focus once; then the reader went on to a chip.
    screen.getByRole("checkbox", { name: /^Warlike/ }).focus();
    await user.click(
      screen.getByRole("link", { name: "Remove Mood: Warlike" })
    );
    expect(router.state.location.search).toBe("");
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 2, name: "All pieces" })
      ).toHaveFocus();
    });
  });

  it("keeps focus on the sort after a new order", async () => {
    const user = userEvent.setup();
    const { router } = await renderLive("?q=kettle");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Sort by" }),
      "title"
    );
    expect(router.state.location.search).toBe("?q=kettle&sort=title");
    await waitFor(() => {
      const select = screen.getByRole("combobox", { name: "Sort by" });
      expect(select).toHaveValue("title");
      expect(select).toHaveFocus();
    });
  });

  it("says in the status that stale categories were left out", async () => {
    await renderPieces(
      "?term=gone",
      loaded("", listOf(FIFTY.slice(0, 3), 3), { stale: ["gone"] })
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Showing 3 pieces. Some categories in this link no longer exist, so we left them out."
    );
  });

  it("says which rows a page shows, so a new page is announced", async () => {
    await renderPieces("?page=2", loaded("?page=2", listOf(FIFTY, 249)));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Showing 51–100 of 249 pieces"
    );
  });
});
