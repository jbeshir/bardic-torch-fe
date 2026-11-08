import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { data } from "react-router";
import { describe, expect, it } from "vitest";
import { historyQuery } from "~/catalogue/query-state";
import type { RevisionSummary, Term } from "~/schemas/catalogue";
import { renderRoutes } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import CategoryLayout, {
  ErrorBoundary as LayoutBoundary,
  shouldRevalidate,
} from "./categories.$slug";
import CategoryHistoryRoute, {
  ErrorBoundary,
} from "./categories.$slug.history";

// A History view from stubbed loader data: the revisions under the head,
// their pages (which never reload the head), the empty state and the
// boundary under the head.

const WAR: Term = {
  slug: "war",
  facet: "topic",
  name: "War",
  display_name: "War",
  description_md: null,
  aliases: [],
  ancestors: [],
  children: [],
  related_affiliation: null,
  piece_count: 5,
  person_count: 0,
  pieces: [],
  persons: [],
};

function revision(id: number): RevisionSummary {
  return {
    id,
    source: "user",
    summary: `Change ${id}`,
    author: { display_name: "Morwen of the Marches" },
    contributors: [],
    created_at: "2026-03-05T12:00:00Z",
  };
}

function renderHistory(
  path: string,
  history: (request: Request) => unknown,
  calls = { layout: 0 }
) {
  return renderRoutes(
    [
      {
        id: "routes/categories.$slug",
        path: "/categories/:slug",
        loader: () => {
          calls.layout += 1;
          return { term: WAR };
        },
        shouldRevalidate,
        Component: CategoryLayout,
        ErrorBoundary: LayoutBoundary,
        HydrateFallback: () => null,
        children: [
          {
            path: "history",
            loader: ({ request }) => history(request),
            Component: CategoryHistoryRoute,
            ErrorBoundary,
          },
        ],
      },
    ],
    path
  );
}

function pages(total: number) {
  return (request: Request) => {
    const { state, canonical } = historyQuery.parse(
      new URL(request.url).searchParams
    );
    return {
      state,
      canonical,
      history: {
        data: Array.from({ length: 50 }, (_, i) => revision(2000 - i)),
        total,
      },
    };
  };
}

describe("/categories/:slug/history page", () => {
  it("lists the revisions under the head, History current", async () => {
    await renderHistory("/categories/war/history", pages(120));
    expect(
      screen.getByRole("heading", { level: 1, name: "War" })
    ).toBeVisible();
    expect(screen.getByText("120 revisions")).toBeVisible();
    expect(
      within(screen.getByRole("table", { name: "Revisions" })).getAllByRole(
        "link",
        { name: /^View changes/ }
      )
    ).toHaveLength(50);
    expect(
      within(screen.getByRole("navigation", { name: "Page views" })).getByRole(
        "link",
        { name: "History" }
      )
    ).toHaveAttribute("aria-current", "page");
  });

  it("pages the history without reloading the head", async () => {
    const calls = { layout: 0 };
    await renderHistory("/categories/war/history", pages(120), calls);
    const user = userEvent.setup();
    await user.click(screen.getByRole("link", { name: "Next" }));
    await waitFor(() => {
      expect(
        screen.getByRole("navigation", { name: "Pagination" })
      ).toHaveTextContent("Page 2");
    });
    expect(calls.layout).toBe(1);
    expect(screen.getByRole("link", { name: "Page 3" })).toHaveAttribute(
      "href",
      "/categories/war/history?page=3"
    );
  });

  it("says when there is no history yet", async () => {
    await renderHistory("/categories/war/history", () => ({
      state: { page: 1 },
      canonical: "",
      history: { data: [], total: 0 },
    }));
    expect(screen.getByText("0 revisions")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "No history yet" })
    ).toBeVisible();
  });

  it("shows a failure under the head", async () => {
    await renderHistory("/categories/war/history", () => {
      throw data({ kind: "server" }, { status: 500 });
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "War" })
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "We couldn’t load the history" })
    ).toBeVisible();
  });

  it("renders the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderHistory("/categories/war/history", pages(2))
    );
  });
});
