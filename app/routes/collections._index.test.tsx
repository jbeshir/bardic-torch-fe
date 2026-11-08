import { screen, within } from "@testing-library/react";
import { data } from "react-router";
import { describe, expect, it } from "vitest";
import { collectionQuery } from "~/catalogue/query-state";
import type { CollectionList, CollectionSummary } from "~/schemas/catalogue";
import { renderRoutes } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import CollectionsRoute, { ErrorBoundary } from "./collections._index";

// The /collections page from stubbed loader data: the list in the API's
// order, its links, the empty and failure states, and the boundary.

function collection(
  id: number,
  name: string,
  overrides: Partial<CollectionSummary> = {}
): CollectionSummary {
  return {
    id,
    name,
    kind: "songbook_pdf",
    url: `https://songs.example/${id}`,
    is_bardic_resource: false,
    ...overrides,
  };
}

function listOf(items: readonly CollectionSummary[]): CollectionList {
  return {
    data: items,
    total: items.length,
    letters: [
      { letter: "0", count: 1 },
      { letter: "N", count: 1 },
    ],
  };
}

function renderCollections(search: string, answer: () => unknown) {
  return renderRoutes(
    [
      {
        path: "/collections",
        loader: () => answer(),
        Component: CollectionsRoute,
        ErrorBoundary,
        HydrateFallback: () => null,
      },
    ],
    `/collections${search}`
  );
}

function loaded(search: string, list: CollectionList) {
  const { state, canonical } = collectionQuery.parse(
    new URLSearchParams(search)
  );
  return () => ({ state, canonical, failure: null, list });
}

const LIST = listOf([
  // Sorted by the API, a leading "The" ignored: the page never re-sorts.
  collection(13, "2nd Northmarch Songbook", { kind: "other" }),
  collection(12, "The Northmarch Songbook", {
    kind: "songbook_website",
    is_bardic_resource: true,
  }),
  collection(5, "Eastmarch Archive", { url: null }),
]);

describe("/collections page", () => {
  it("lists the collections in the API's order, each with its kind and link", async () => {
    await renderCollections("", loaded("", LIST));
    expect(
      screen.getByRole("heading", { level: 1, name: "Collections" })
    ).toBeVisible();
    expect(screen.getByText("3 collections")).toBeVisible();
    const results = screen.getByRole("region", { name: "All collections" });
    expect(
      within(results)
        .getAllByRole("link", { name: /Songbook$|Archive$/ })
        .map(link => link.textContent)
    ).toEqual([
      "2nd Northmarch Songbook",
      "The Northmarch Songbook",
      "Eastmarch Archive",
    ]);
    const songbook = within(results)
      .getByRole("link", { name: "The Northmarch Songbook" })
      .closest("li");
    if (!songbook) throw new Error("no row");
    expect(songbook).toHaveTextContent("Songbook website");
    expect(songbook).toHaveTextContent("Made for bards");
    expect(
      within(songbook).getByRole("link", { name: /Visit The Northmarch/ })
    ).toHaveAttribute("rel", "nofollow ugc noopener");
    // No address, no Visit.
    expect(
      within(results).queryByRole("link", { name: /Visit Eastmarch/ })
    ).toBeNull();
    expect(
      screen.getByRole("navigation", { name: "Collections by letter" })
    ).toBeVisible();
  });

  it("shows the chips and the empty state for filters that match nothing", async () => {
    await renderCollections(
      "?kind=wiki&letter=Q",
      loaded("?kind=wiki&letter=Q", listOf([]))
    );
    expect(
      screen.getByRole("heading", {
        name: "No collections match these filters",
      })
    ).toBeVisible();
    expect(screen.getByText("Try another letter or kind.")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Remove Kind: Wiki" })
    ).toHaveAttribute("href", "/collections?letter=Q");
    expect(screen.getByRole("checkbox", { name: "Wiki" })).toBeChecked();
  });

  it("keeps the filter under a slow search's message", async () => {
    const { state, canonical } = collectionQuery.parse(
      new URLSearchParams("?kind=wiki")
    );
    await renderCollections("?kind=wiki", () => ({
      state,
      canonical,
      failure: { kind: "search_timeout" },
      list: null,
    }));
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "That search took too long",
      })
    ).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Wiki" })).toBeChecked();
  });

  it("is the server error for a thrown 500", async () => {
    await renderCollections("", () => {
      throw data({ kind: "server" }, { status: 500 });
    });
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "We couldn’t load the collections",
      })
    ).toBeVisible();
  });

  it("renders the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderCollections("", loaded("", LIST))
    );
  });
});
