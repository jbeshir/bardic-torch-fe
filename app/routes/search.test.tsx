import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { data } from "react-router";
import { describe, expect, it } from "vitest";
import type { PersonList, PieceList } from "~/schemas/catalogue";
import { renderRoutes } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import SearchRoute, { ErrorBoundary } from "./search";

// The /search page from stubbed loader data: the results, a section's
// failure, the empty search and no results. The loader itself is
// search.ssr.test.ts's.

const PIECES: PieceList = {
  data: [
    {
      slug: "northmarch-rising",
      title: "Northmarch Rising",
      kind: "song",
      secondary_kinds: [],
      conservation_status: "low_risk",
      is_stub: false,
    },
  ],
  total: 31,
  facets: { terms: [], kinds: [], conservation_statuses: [], letters: [] },
};

const PERSONS: PersonList = {
  data: [
    {
      slug: "northmarch-bards",
      name: "Northmarch Bards",
      kind: "group",
      is_stub: false,
    },
  ],
  total: 1,
  letters: [{ letter: "N", count: 1 }],
};

const TERMS = {
  shown: [
    {
      slug: "northmarch",
      facet: "affiliation",
      name: "Northmarch",
      display_name: "Northmarch",
      parent_slug: null,
      piece_count: 0,
      person_count: 3,
    },
  ],
  total: 1,
} as const;

function renderSearch(search: string, answer: (q: string | null) => unknown) {
  return renderRoutes(
    [
      {
        path: "/search",
        loader: ({ request }) =>
          answer(new URL(request.url).searchParams.get("q")),
        Component: SearchRoute,
        ErrorBoundary,
        HydrateFallback: () => null,
      },
    ],
    `/search${search}`
  );
}

const found =
  (overrides: Record<string, unknown> = {}) =>
  () => ({
    q: "northmarch",
    pieces: { ok: true, data: PIECES },
    persons: { ok: true, data: PERSONS },
    terms: { ok: true, data: TERMS },
    ...overrides,
  });

describe("/search page", () => {
  it("shows the pieces, bards and categories that match, with the search prefilled", async () => {
    await renderSearch("?q=northmarch", found());
    expect(
      screen.getByRole("heading", { level: 1, name: "Search" })
    ).toBeVisible();
    expect(
      screen.getByRole("searchbox", { name: "Search the catalogue" })
    ).toHaveValue("northmarch");
    expect(screen.getByRole("status")).toHaveTextContent(
      "31 pieces, 1 bard and 1 category match ‘northmarch’"
    );
    const pieces = screen.getByRole("region", { name: "Pieces" });
    expect(
      within(pieces).getByRole("link", { name: "Northmarch Rising" })
    ).toHaveAttribute("href", "/pieces/northmarch-rising");
    expect(
      within(pieces).getByRole("link", { name: "See all 31 pieces" })
    ).toHaveAttribute("href", "/pieces?q=northmarch");
    const bards = screen.getByRole("region", { name: "Bards" });
    expect(
      within(bards).getByRole("link", { name: "Northmarch Bards" })
    ).toHaveAttribute("href", "/bards/northmarch-bards");
    // One bard: nothing more to see.
    expect(within(bards).queryByRole("link", { name: /See all/ })).toBeNull();
    const categories = screen.getByRole("region", { name: "Categories" });
    expect(
      within(categories).getByRole("link", { name: /Northmarch/ })
    ).toHaveAttribute("href", "/categories/northmarch");
    expect(within(categories).getByText(/Affiliation/)).toBeVisible();
  });

  it("keeps the other sections when one fails, saying why", async () => {
    await renderSearch(
      "?q=northmarch",
      found({
        pieces: { ok: false, failure: { kind: "search_timeout" } },
        terms: { ok: false, failure: { kind: "resting", retryAfter: 30 } },
      })
    );
    const pieces = screen.getByRole("region", { name: "Pieces" });
    expect(within(pieces).getByText("That search took too long")).toBeVisible();
    expect(within(pieces).getByText("Try fewer words.")).toBeVisible();
    expect(
      within(pieces).getByRole("button", { name: "Try again" })
    ).toBeVisible();
    const categories = screen.getByRole("region", { name: "Categories" });
    expect(
      within(categories).getByText("We couldn’t load the categories")
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Northmarch Bards" })
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "1 bard match ‘northmarch’"
    );
  });

  it("says when a section has nothing", async () => {
    await renderSearch(
      "?q=northmarch",
      found({ persons: { ok: true, data: { ...PERSONS, data: [], total: 0 } } })
    );
    expect(screen.getByText("No bards match.")).toBeVisible();
  });

  it("says what to type with no search", async () => {
    await renderSearch("", () => ({ q: undefined }));
    expect(
      screen.getByText("Type a word from a title, a name or a category.")
    ).toBeVisible();
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("says nothing matches, and offers to browse", async () => {
    await renderSearch(
      "?q=zzz",
      found({
        q: "zzz",
        pieces: { ok: true, data: { ...PIECES, data: [], total: 0 } },
        persons: { ok: true, data: { ...PERSONS, data: [], total: 0 } },
        terms: { ok: true, data: { shown: [], total: 0 } },
      })
    );
    expect(
      screen.getByRole("heading", { name: "Nothing matches ‘zzz’" })
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Browse pieces" })).toHaveAttribute(
      "href",
      "/pieces"
    );
    expect(screen.getByRole("status")).toHaveTextContent("No results");
  });

  it("shows how many more categories match than are shown", async () => {
    const shown = Array.from({ length: 12 }, (_, i) => ({
      ...TERMS.shown[0],
      slug: `northmarch-${i}`,
    }));
    await renderSearch(
      "?q=northmarch",
      found({ terms: { ok: true, data: { shown, total: 15 } } })
    );
    expect(screen.getByText(/and\s+3\s+more/)).toBeVisible();
  });

  it.each([
    [{ kind: "resting", retryAfter: 60 }, 503, "Bardic Torch is resting"],
    [{ kind: "server" }, 500, "We couldn’t load the search results"],
  ] as const)(
    "shows a thrown %o in its error boundary",
    async (failure, status, title) => {
      await renderSearch("?q=x", () => {
        throw data(failure, { status });
      });
      expect(
        screen.getByRole("heading", { level: 1, name: title })
      ).toBeVisible();
    }
  );

  it("searches again from its own box, by keyboard", async () => {
    const user = userEvent.setup();
    const router = await renderSearch("?q=northmarch", found());
    const box = screen.getByRole("searchbox", { name: "Search the catalogue" });
    await user.tab();
    expect(box).toHaveFocus();
    await user.clear(box);
    await user.type(box, "kettle{Enter}");
    expect(router.state.location.search).toBe("?q=kettle");
  });

  it("keeps focus in its box after a new search, and shows each search's words", async () => {
    const user = userEvent.setup();
    const router = await renderSearch("?q=northmarch", q =>
      found({ q: q ?? undefined })()
    );
    const box = screen.getByRole("searchbox", { name: "Search the catalogue" });
    await user.click(box);
    await user.clear(box);
    await user.type(box, "kettle{Enter}");
    expect(router.state.location.search).toBe("?q=kettle");
    // The same box, still focused: not rebuilt for the new search.
    expect(
      screen.getByRole("searchbox", { name: "Search the catalogue" })
    ).toBe(box);
    expect(box).toHaveFocus();
    // A search made elsewhere (Back, the header) shows its words here.
    await user.tab();
    await act(() => router.navigate("/search?q=wren"));
    expect(box).toHaveValue("wren");
  });

  it("has its status from the start, empty before a search, then filled", async () => {
    const router = await renderSearch("", q =>
      q === null ? { q: undefined } : found({ q })()
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/^$/);
    await act(() => router.navigate("/search?q=northmarch"));
    // The same live region, its text changed: announced.
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent("match ‘northmarch’");
  });

  it("names its search landmark apart from the site's", async () => {
    await renderSearch("?q=northmarch", found());
    expect(
      screen.getByRole("search", { name: "Search the catalogue" })
    ).toBeVisible();
  });

  it("has the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderSearch("?q=northmarch", found())
    );
  });
});
