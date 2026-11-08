import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { data } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { pieceQuery } from "~/catalogue/query-state";
import type { PieceList, PieceSummary } from "~/schemas/catalogue";
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
      terms: [],
      kinds: [],
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

/** The loader data for `search` with `list`, as the loader returns it. */
function loaded(search: string, list: PieceList) {
  const { state, canonical } = pieceQuery.parse(new URLSearchParams(search));
  return () => ({ state, canonical, failure: null, list });
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
    expect(screen.getByRole("status")).toHaveTextContent("Showing 249 pieces");
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
    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveValue(
      "relevance"
    );
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
    await renderPieces("?q=zzz", loaded("?q=zzz", listOf([], 0)));
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
        { state, canonical, failure: { kind: "search_timeout" }, list: null },
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
        { state, canonical, failure: { kind: "invalid_filters" }, list: null },
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

  it("is walked with Tab: the search, the letters, the results, the pages", async () => {
    const user = userEvent.setup();
    await renderPieces("", loaded("", listOf(FIFTY, 249)));
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
    expect(screen.getByRole("link", { name: "Drill Song 1" })).toHaveFocus();
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
