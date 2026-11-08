import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { data } from "react-router";
import { describe, expect, it } from "vitest";
import { historyQuery } from "~/catalogue/query-state";
import type { Event, RevisionSummary } from "~/schemas/catalogue";
import { renderRoutes } from "~/test/router";
import { renderMarkdown } from "~/server/markdown.server";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import EventLayout, {
  ErrorBoundary as LayoutBoundary,
  shouldRevalidate,
} from "./events.$slug";
import EventHistoryRoute, { ErrorBoundary } from "./events.$slug.history";

// An event's History view from stubbed loader data: the revisions under
// the head (from the layout, through the outlet), their pages (which never
// reload the head), the empty list and the boundary under the head. The
// loader is events.$slug.history.ssr.test.ts's.

const REVEL: Event = {
  slug: "midwinter-revel",
  name: "Midwinter Revel",
  kind: "event",
  description_md: "A winter feast.",
  performances: [
    {
      piece: null,
      link: {
        url: "https://video.example/x",
        title: "The feast",
        platform: null,
      },
      year: 2025,
      performers: [],
      description_verbatim: "",
    },
  ],
  performances_total: 1,
};

const DESCRIPTION = renderMarkdown(REVEL.description_md);

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
  history: (request: Request) => unknown,
  calls = { layout: 0 }
) {
  return renderRoutes(
    [
      {
        id: "routes/events.$slug",
        path: "/events/:slug",
        loader: () => {
          calls.layout += 1;
          return { event: REVEL, description: DESCRIPTION };
        },
        shouldRevalidate,
        Component: EventLayout,
        ErrorBoundary: LayoutBoundary,
        HydrateFallback: () => null,
        children: [
          {
            path: "history",
            loader: ({ request }) => history(request),
            Component: EventHistoryRoute,
            ErrorBoundary,
          },
        ],
      },
    ],
    "/events/midwinter-revel/history"
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
        data: Array.from({ length: Math.min(total, 50) }, (_, i) =>
          revision(2000 - i)
        ),
        total,
      },
    };
  };
}

describe("/events/:slug/history page", () => {
  it("lists the revisions under the head, History current", async () => {
    await renderHistory(pages(120));
    expect(
      within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByRole(
        "link",
        { name: "Events and venues" }
      )
    ).toHaveAttribute("href", "/events");
    expect(
      screen.getByRole("heading", { level: 1, name: "Midwinter Revel" })
    ).toBeVisible();
    expect(screen.getByText("120 revisions")).toBeVisible();
    expect(
      within(screen.getByRole("table", { name: "Revisions" })).getAllByRole(
        "link",
        { name: /^View changes/ }
      )
    ).toHaveLength(50);
    const views = screen.getByRole("navigation", { name: "Page views" });
    expect(
      within(views).getByRole("link", { name: "History" })
    ).toHaveAttribute("aria-current", "page");
    expect(within(views).getByRole("link", { name: "Read" })).toHaveAttribute(
      "href",
      "/events/midwinter-revel"
    );
    // The Read view's parts stay there.
    expect(screen.queryByRole("region", { name: "Licensing" })).toBeNull();
  });

  it("pages the history without reloading the head", async () => {
    const calls = { layout: 0 };
    await renderHistory(pages(120), calls);
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
      "/events/midwinter-revel/history?page=3"
    );
  });

  it("says when there is no history yet", async () => {
    await renderHistory(() => ({
      state: { page: 1 },
      canonical: "",
      history: { data: [], total: 0 },
    }));
    expect(screen.getByText("0 revisions")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "No history yet" })
    ).toBeVisible();
  });

  it.each([
    [{ kind: "server" }, 500, "We couldn’t load the history"],
    [{ kind: "not_found" }, 404, "We couldn’t find that event or venue"],
    [{ kind: "resting", retryAfter: 30 }, 503, "Bardic Torch is resting"],
  ])("shows a %j failure under the head", async (failure, status, title) => {
    await renderHistory(() => {
      throw data(failure, { status });
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Midwinter Revel" })
    ).toBeVisible();
    // The head keeps the page's one h1; the failure is an h2 under it.
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 2, name: title })
    ).toBeVisible();
  });

  it("shows a thrown non-failure as the server error under the head", async () => {
    await renderHistory(() => {
      throw new Error("boom");
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Midwinter Revel" })
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "We couldn’t load the history",
      })
    ).toBeVisible();
  });

  it("renders the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() => renderHistory(pages(2)));
  });
});
