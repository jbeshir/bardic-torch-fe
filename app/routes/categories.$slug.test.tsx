import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { data } from "react-router";
import { describe, expect, it } from "vitest";
import { termMembersQuery } from "~/catalogue/query-state";
import type { PieceSummary, Term } from "~/schemas/catalogue";
import { renderMarkdown } from "~/server/markdown.server";
import { renderRoutes } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import CategoryLayout, {
  ErrorBoundary as LayoutBoundary,
  shouldRevalidate,
} from "./categories.$slug";
import CategoryMembersRoute, {
  ErrorBoundary as MembersBoundary,
} from "./categories.$slug._index";

// A category's page from stubbed loader data: the head and Read view, the
// members (pieces or bards), member paging that reloads the members only,
// the empty state, and the boundaries.

function piece(n: number): PieceSummary {
  return {
    slug: `drill-song-${n}`,
    title: `Drill Song ${n}`,
    kind: "song",
    secondary_kinds: [],
    conservation_status: "unassessed",
    is_stub: false,
  };
}

const SWORDS: Term = {
  slug: "swords",
  facet: "topic",
  name: "Swords",
  display_name: "Swords",
  description_md: "Blades in song.\n\nAnd in *story*.",
  aliases: ["Blades", "Steel"],
  ancestors: [
    { slug: "war", facet: "topic", display_name: "War" },
    { slug: "battles", facet: "topic", display_name: "Battles" },
  ],
  children: [
    {
      term: { slug: "sabres", facet: "topic", display_name: "Sabres" },
      piece_count: 1,
      person_count: 0,
    },
  ],
  related_affiliation: {
    slug: "northmarch",
    facet: "affiliation",
    display_name: "Northmarch",
  },
  piece_count: 120,
  person_count: 0,
  pieces: Array.from({ length: 50 }, (_, i) => piece(i + 1)),
  persons: [],
};

const NORTHMARCH: Term = {
  ...SWORDS,
  slug: "northmarch",
  facet: "affiliation",
  name: "Northmarch",
  display_name: "Northmarch",
  description_md: null,
  aliases: [],
  ancestors: [],
  children: [],
  related_affiliation: null,
  piece_count: 0,
  person_count: 1,
  pieces: [],
  persons: [
    {
      slug: "wren-of-the-vale",
      name: "Wren of the Vale",
      kind: "community_bard",
      is_stub: false,
    },
  ],
};

type Calls = { layout: number; members: number };

function renderCategory(
  path: string,
  term: Term,
  calls: Calls = { layout: 0, members: 0 },
  members: (request: Request) => unknown = request => {
    const url = new URL(request.url);
    const { state, canonical } = termMembersQuery.parse(url.searchParams);
    return { state, canonical, term };
  }
) {
  return renderRoutes(
    [
      {
        id: "layout",
        path: "/categories/:slug",
        loader: () => {
          calls.layout += 1;
          return { term, description: renderMarkdown(term.description_md) };
        },
        shouldRevalidate,
        Component: CategoryLayout,
        ErrorBoundary: LayoutBoundary,
        HydrateFallback: () => null,
        children: [
          {
            index: true,
            loader: ({ request }) => {
              calls.members += 1;
              return members(request);
            },
            Component: CategoryMembersRoute,
            ErrorBoundary: MembersBoundary,
          },
          { path: "history", element: <p>The history</p> },
        ],
      },
    ],
    path
  );
}

describe("/categories/:slug page", () => {
  it("has the head: breadcrumbs through the facet and ancestors, the meta and tabs", async () => {
    await renderCategory("/categories/swords", SWORDS);
    expect(
      screen.getByRole("heading", { level: 1, name: "Swords" })
    ).toBeVisible();
    expect(screen.getByText("Topic · 120 pieces")).toBeVisible();
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(
      within(crumbs)
        .getAllByRole("link")
        .map(link => [link.textContent, link.getAttribute("href")])
    ).toEqual([
      ["Categories", "/categories"],
      ["Topic", "/categories?facet=topic"],
      ["War", "/categories/war"],
      ["Battles", "/categories/battles"],
    ]);
    const views = screen.getByRole("navigation", { name: "Page views" });
    expect(within(views).getByRole("link", { name: "Read" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("has the infobox, description, subcategories, chips and licence on Read", async () => {
    await renderCategory("/categories/swords", SWORDS);
    const infobox = screen.getByRole("complementary", { name: "Swords" });
    expect(infobox).toHaveTextContent("Also calledBlades, Steel");
    expect(
      within(infobox).getByRole("link", { name: "Battles" })
    ).toHaveAttribute("href", "/categories/battles");
    expect(
      within(infobox).getByRole("link", { name: "Northmarch" })
    ).toHaveAttribute("href", "/categories/northmarch");
    // The description's Markdown, rendered by the server's renderer.
    expect(screen.getByText("story", { selector: "em" })).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Sabres (1 piece)" })
    ).toBeVisible();
    const chips = screen.getByRole("navigation", { name: "Categories" });
    expect(
      within(chips).getByRole("link", { name: "Topic: Swords" })
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(chips).getByRole("link", { name: "Topic: War" })
    ).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "page history" })).toHaveAttribute(
      "href",
      "/categories/swords/history"
    );
  });

  it("lists the members, with the filter link and pages", async () => {
    await renderCategory("/categories/swords", SWORDS);
    const members = screen.getByRole("region", { name: "Pieces" });
    expect(
      within(members).getAllByRole("link", { name: /^Drill Song/ })
    ).toHaveLength(50);
    expect(
      within(members).getByRole("link", { name: "Filter these pieces" })
    ).toHaveAttribute("href", "/pieces?term=swords");
    expect(
      within(members).getByRole("link", { name: "Page 3" })
    ).toHaveAttribute("href", "/categories/swords?page=3");
  });

  it("pages the members without reloading the head", async () => {
    const calls = { layout: 0, members: 0 };
    await renderCategory("/categories/swords", SWORDS, calls);
    const user = userEvent.setup();
    await user.click(screen.getByRole("link", { name: "Next" }));
    await waitFor(() => {
      expect(
        screen.getByRole("navigation", { name: "Pagination" })
      ).toHaveTextContent("Page 2");
    });
    expect(calls).toEqual({ layout: 1, members: 2 });
  });

  it("marks the members busy while a page loads, keeping the old ones", async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    let calls = 0;
    await renderCategory(
      "/categories/swords",
      SWORDS,
      { layout: 0, members: 0 },
      request => {
        const { state, canonical } = termMembersQuery.parse(
          new URL(request.url).searchParams
        );
        calls += 1;
        if (calls === 1) return { state, canonical, term: SWORDS };
        return new Promise(resolve => {
          release = () => resolve({ state, canonical, term: SWORDS });
        });
      }
    );
    await user.click(screen.getByRole("link", { name: "Next" }));
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    await act(async () => {
      release();
    });
    expect(document.querySelector("[aria-busy]")).toBeNull();
  });

  it("lists an affiliation's bards, with a search link", async () => {
    await renderCategory("/categories/northmarch", NORTHMARCH);
    expect(screen.getByText("Affiliation · 1 bard")).toBeVisible();
    const members = screen.getByRole("region", { name: "Bards" });
    expect(
      within(members).getByRole("link", { name: "Wren of the Vale" })
    ).toHaveAttribute("href", "/bards/wren-of-the-vale");
    expect(
      within(members).getByRole("link", { name: "Search these bards" })
    ).toHaveAttribute("href", "/bards?affiliation=northmarch");
    // No aliases, parent or related affiliation: no infobox.
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("says when nothing is in the category yet", async () => {
    await renderCategory("/categories/swords", {
      ...SWORDS,
      piece_count: 0,
      pieces: [],
    });
    expect(
      screen.getByRole("heading", { name: "Nothing here yet" })
    ).toBeVisible();
    expect(
      screen.getByText("No pieces are in this category yet.")
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Browse pieces" })).toHaveAttribute(
      "href",
      "/pieces"
    );
  });

  it("keeps the head and leaves the Read parts out on History", async () => {
    await renderCategory("/categories/swords/history", SWORDS);
    expect(
      screen.getByRole("heading", { level: 1, name: "Swords" })
    ).toBeVisible();
    expect(screen.getByText("The history")).toBeVisible();
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByText("Subcategories")).toBeNull();
    expect(screen.queryByRole("link", { name: "page history" })).toBeNull();
    const views = screen.getByRole("navigation", { name: "Page views" });
    expect(
      within(views).getByRole("link", { name: "History" })
    ).toHaveAttribute("aria-current", "page");
  });

  it("shows a members failure under the head", async () => {
    await renderCategory("/categories/swords", SWORDS, undefined, () => {
      throw data({ kind: "server" }, { status: 500 });
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Swords" })
    ).toBeVisible();
    // The head keeps the page's one h1; the failure is an h2 under it.
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "We couldn’t load the members of this category",
      })
    ).toBeVisible();
  });

  it("is the category's 404 for a thrown not_found", async () => {
    await renderRoutes(
      [
        {
          path: "/categories/:slug",
          loader: () => {
            throw data({ kind: "not_found" }, { status: 404 });
          },
          Component: CategoryLayout,
          ErrorBoundary: LayoutBoundary,
          HydrateFallback: () => null,
        },
      ],
      "/categories/no-such"
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "We couldn’t find that category",
      })
    ).toBeVisible();
  });

  it("renders the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderCategory("/categories/swords", SWORDS)
    );
  });
});
