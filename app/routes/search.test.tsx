import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { PersonList, PieceList } from "~/schemas/catalogue";
import { renderRoutes } from "~/test/router";
import SearchRoute, { ErrorBoundary } from "./search";

// The /search page from stubbed loader data: the results, a section's
// failure, the empty search and no results.

const PIECES: PieceList = {
  data: [
    {
      slug: "northmarch-rising",
      title: "Northmarch Rising",
      kind: "song",
      conservation_status: "low_risk",
      is_stub: false,
      credit_names: [],
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
  it("keeps the other sections when one fails, saying why", async () => {
    await renderSearch(
      "?q=northmarch",
      found({
        pieces: { ok: false, failure: { kind: "try_again" } },
        terms: { ok: false, failure: { kind: "try_again" } },
      })
    );
    const pieces = screen.getByRole("region", { name: "Pieces" });
    expect(
      within(pieces).getByText("We couldn’t load the pieces")
    ).toBeVisible();
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
});
