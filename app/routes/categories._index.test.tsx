import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { categoryIndexQuery } from "~/catalogue/query-state";
import type { TermListItem } from "~/schemas/catalogue";
import { renderRoutes } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import CategoriesRoute, { ErrorBoundary, handle } from "./categories._index";
import { data } from "react-router";

// The /categories page from stubbed loader data: the full index, one facet
// alone, the empty facet, the counts' region failure and the boundary.

function term(
  slug: string,
  facet: TermListItem["facet"],
  overrides: Partial<TermListItem> = {}
): TermListItem {
  return {
    slug,
    facet,
    name: slug,
    display_name: slug.replace(/^./, c => c.toUpperCase()),
    parent_slug: null,
    piece_count: 2,
    person_count: 0,
    ...overrides,
  };
}

const TERMS = {
  data: [
    term("warlike", "mood", { piece_count: 31 }),
    term("war", "topic"),
    term("battles", "topic", { parent_slug: "war" }),
    term("northmarch", "affiliation", { piece_count: 0, person_count: 4 }),
  ],
};

const COUNTS = {
  kinds: [
    { kind: "song", count: 120 },
    { kind: "poem", count: 3 },
  ],
  conservation_statuses: [{ conservation_status: "endangered", count: 7 }],
} as const;

function renderCategories(search: string, answer: () => unknown) {
  return renderRoutes(
    [
      {
        path: "/categories",
        loader: () => answer(),
        Component: CategoriesRoute,
        ErrorBoundary,
        HydrateFallback: () => null,
      },
    ],
    `/categories${search}`
  );
}

function loaded(
  search: string,
  terms: typeof TERMS | null,
  counts: typeof COUNTS | "failed" | null
) {
  const { state, canonical } = categoryIndexQuery.parse(
    new URLSearchParams(search)
  );
  return () => ({ state, canonical, terms, counts });
}

describe("/categories page", () => {
  it("lists the sections in order, each facet's terms as a tree", async () => {
    await renderCategories("", loaded("", TERMS, COUNTS));
    expect(
      screen.getByRole("heading", { level: 1, name: "Categories" })
    ).toBeVisible();
    expect(
      screen.getAllByRole("heading", { level: 2 }).map(h => h.textContent)
    ).toEqual([
      "Kind",
      "Mood",
      "Topic",
      "Culture",
      "Language",
      "Legendaria",
      "Form",
      "Origin",
      "Other",
      "Affiliation",
      "Conservation status",
    ]);
    const topic = screen.getByRole("region", { name: "Topic" });
    expect(
      within(topic).getByRole("link", { name: "Battles" })
    ).toHaveAttribute("href", "/categories/battles");
    expect(
      within(screen.getByRole("region", { name: "Affiliation" })).getByText(
        "4 bards"
      )
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Culture" })).getByText(
        "No categories here yet."
      )
    ).toBeVisible();
  });

  it("links the kinds and statuses to the pieces with them", async () => {
    await renderCategories("", loaded("", TERMS, COUNTS));
    const kinds = screen.getByRole("region", { name: "Kind" });
    expect(within(kinds).getByRole("link", { name: "Song" })).toHaveAttribute(
      "href",
      "/pieces?kind=song"
    );
    expect(within(kinds).getByText("120 pieces")).toBeInTheDocument();
    const statuses = screen.getByRole("region", {
      name: "Conservation status",
    });
    expect(
      within(statuses).getByRole("link", { name: "Browse endangered pieces" })
    ).toHaveAttribute("href", "/pieces?status=endangered");
    expect(within(statuses).getByText("7 pieces")).toBeInTheDocument();
    // A status with no pieces still says so; the badge isn't the link.
    expect(within(statuses).getAllByText("0 pieces")).toHaveLength(4);
    expect(
      within(statuses).queryByRole("link", { name: /^Conservation status/ })
    ).toBeNull();
  });

  it("shows a SectionError for the counts and keeps the tree", async () => {
    await renderCategories("", loaded("", TERMS, "failed"));
    expect(
      screen.getByText("We couldn’t load the kinds and conservation statuses")
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Kind" })).toBeNull();
    expect(screen.getByRole("link", { name: "Warlike" })).toBeVisible();
  });

  it("shows one facet under its own h1, the section nav marking it", async () => {
    await renderCategories(
      "?facet=mood",
      loaded("?facet=mood", { data: [TERMS.data[0] as TermListItem] }, null)
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Mood" })
    ).toBeVisible();
    expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(0);
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(
      within(crumbs).getByRole("link", { name: "Categories" })
    ).toHaveAttribute("href", "/categories");
    const sections = screen.getByRole("navigation", {
      name: "Category sections",
    });
    expect(
      within(sections).getByRole("link", { name: "Mood" })
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("1 category")).toBeVisible();
  });

  it("shows the kinds alone for ?facet=kind", async () => {
    await renderCategories("?facet=kind", loaded("?facet=kind", null, COUNTS));
    expect(
      screen.getByRole("heading", { level: 1, name: "Kind" })
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Poem" })).toHaveAttribute(
      "href",
      "/pieces?kind=poem"
    );
    expect(screen.queryByText(/Browse endangered/)).toBeNull();
  });

  it("says a facet with no terms has none yet", async () => {
    await renderCategories(
      "?facet=other",
      loaded("?facet=other", { data: [] }, null)
    );
    expect(screen.getByText("No categories here yet.")).toBeVisible();
  });

  it("moves from the section nav into a section with the keyboard", async () => {
    const router = await renderCategories("", loaded("", TERMS, COUNTS));
    const user = userEvent.setup();
    const sections = screen.getByRole("navigation", {
      name: "Category sections",
    });
    within(sections).getByRole("link", { name: "Topic" }).focus();
    await user.keyboard("{Enter}");
    expect(router.state.location.search).toBe("?facet=topic");
  });

  it("is the resting page for a thrown outage", async () => {
    await renderCategories("", () => {
      throw data({ kind: "resting", retryAfter: 60 }, { status: 503 });
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Bardic Torch is resting" })
    ).toBeVisible();
  });

  it("titles a server error by what didn't load", async () => {
    await renderCategories("", () => {
      throw data({ kind: "server" }, { status: 500 });
    });
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "We couldn’t load the categories",
      })
    ).toBeVisible();
  });

  it("renders the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderCategories("", loaded("", TERMS, COUNTS))
    );
  });
});

describe("/categories page identity", () => {
  it("makes each facet a page of its own for the shell's focus and title", () => {
    expect(handle.pageKey(new URLSearchParams("facet=mood"))).toBe("mood");
    expect(handle.pageKey(new URLSearchParams("facet=topic"))).toBe("topic");
    expect(handle.pageKey(new URLSearchParams(""))).toBe("");
  });
});
