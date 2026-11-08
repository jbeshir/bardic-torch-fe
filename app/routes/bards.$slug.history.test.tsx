import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { data } from "react-router";
import { describe, expect, it } from "vitest";
import { historyQuery } from "~/catalogue/query-state";
import type { Person, RevisionSummary } from "~/schemas/catalogue";
import { personOf } from "~/test/catalogue";
import { renderRoutes } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import BardLayout, {
  ErrorBoundary as LayoutBoundary,
  shouldRevalidate,
} from "./bards.$slug";
import BardHistoryRoute, { ErrorBoundary } from "./bards.$slug.history";

// A person's History view from stubbed loader data: the revisions under
// their head (from the layout, through the outlet), their pages (which
// never reload the person), a no-page person's history and the boundary
// under the head. The loader is bards.$slug.history.ssr.test.ts's.

const NO_PROSE = { notes: null, licensingNotes: null };

const HOLLIS = personOf({
  slug: "hollis-fenn",
  name: "Hollis Fenn",
  is_stub: true,
  status: "prefers_no_page",
  status_date: "2026-03-01",
  status_source_url: "https://requests.example/statements/12",
  profile: null,
});

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
  {
    person = personOf(),
    calls = { layout: 0 },
    path = "/bards/wren-of-the-vale/history",
  }: {
    readonly person?: Person;
    readonly calls?: { layout: number };
    readonly path?: string;
  } = {}
) {
  return renderRoutes(
    [
      {
        id: "routes/bards.$slug",
        path: "/bards/:slug",
        loader: () => {
          calls.layout += 1;
          return { person, markdown: NO_PROSE };
        },
        shouldRevalidate,
        Component: BardLayout,
        ErrorBoundary: LayoutBoundary,
        HydrateFallback: () => null,
        children: [
          {
            path: "history",
            loader: ({ request }) => history(request),
            Component: BardHistoryRoute,
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
        data: Array.from({ length: Math.min(total, 50) }, (_, i) =>
          revision(2000 - i)
        ),
        total,
      },
    };
  };
}

describe("/bards/:slug/history page", () => {
  it("lists the revisions under the person's head, History current", async () => {
    await renderHistory(pages(120));
    expect(
      within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByRole(
        "link",
        { name: "Bards" }
      )
    ).toHaveAttribute("href", "/bards");
    expect(
      screen.getByRole("heading", { level: 1, name: "Wren of the Vale" })
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
      "/bards/wren-of-the-vale"
    );
    // The Read view's parts stay there.
    expect(screen.queryByRole("region", { name: "Licensing" })).toBeNull();
    expect(screen.queryByText(/page history/)).toBeNull();
  });

  it("still shows a no-page person's history, by its address, under their banner", async () => {
    await renderHistory(pages(2), {
      person: HOLLIS,
      path: "/bards/hollis-fenn/history",
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Hollis Fenn" })
    ).toBeVisible();
    expect(
      screen.getByText("Hollis Fenn has asked not to have a page here.")
    ).toBeVisible();
    expect(screen.getByText("2 revisions")).toBeVisible();
    expect(screen.getByRole("link", { name: "History" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("pages the history without reloading the person", async () => {
    const calls = { layout: 0 };
    await renderHistory(pages(120), { calls });
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
      "/bards/wren-of-the-vale/history?page=3"
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
    [{ kind: "not_found" }, 404, "We couldn’t find that bard"],
    [{ kind: "resting", retryAfter: 30 }, 503, "Bardic Torch is resting"],
  ])("shows a %j failure under the head", async (failure, status, title) => {
    await renderHistory(() => {
      throw data(failure, { status });
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Wren of the Vale" })
    ).toBeVisible();
    // The head keeps the page's one h1; the failure is an h2 under it.
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 2, name: title })
    ).toBeVisible();
  });

  it("renders the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() => renderHistory(pages(2)));
  });
});
