import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { data } from "react-router";
import { describe, expect, it } from "vitest";
import { historyQuery } from "~/catalogue/query-state";
import type { Piece, RevisionSummary } from "~/schemas/catalogue";
import { pieceOf } from "~/test/catalogue";
import { renderRoutes } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import PieceLayout, {
  ErrorBoundary as LayoutBoundary,
  shouldRevalidate,
} from "./pieces.$slug";
import PieceHistoryRoute, { ErrorBoundary } from "./pieces.$slug.history";

// A piece's History view from stubbed loader data: the revisions under
// the piece's head (from B's layout, through the outlet), their pages
// (which never reload the piece), the empty state and the boundary under
// the head. The loader is pieces.$slug.history.ssr.test.ts's.

const NO_PROSE = {
  notes: null,
  versions: null,
  historicalSource: null,
  licensingNotes: null,
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
  history: (request: Request) => unknown,
  {
    piece = pieceOf(),
    calls = { layout: 0 },
    path = "/pieces/the-copper-kettle/history",
  }: {
    readonly piece?: Piece;
    readonly calls?: { layout: number };
    readonly path?: string;
  } = {}
) {
  return renderRoutes(
    [
      {
        id: "routes/pieces.$slug",
        path: "/pieces/:slug",
        loader: () => {
          calls.layout += 1;
          return { piece, markdown: NO_PROSE };
        },
        shouldRevalidate,
        Component: PieceLayout,
        ErrorBoundary: LayoutBoundary,
        HydrateFallback: () => null,
        children: [
          {
            path: "history",
            loader: ({ request }) => history(request),
            Component: PieceHistoryRoute,
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

describe("/pieces/:slug/history page", () => {
  it("lists the revisions under the piece's head, History current", async () => {
    await renderHistory(pages(120));
    expect(
      within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByRole(
        "link",
        { name: "Pieces" }
      )
    ).toHaveAttribute("href", "/pieces");
    expect(
      screen.getByRole("heading", { level: 1, name: "The Copper Kettle" })
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
      "/pieces/the-copper-kettle"
    );
    // The Read view's parts stay there.
    expect(screen.queryByRole("region", { name: "Licensing" })).toBeNull();
    expect(screen.queryByText(/page history/)).toBeNull();
  });

  it("keeps a restricted piece's banner on its history", async () => {
    await renderHistory(pages(2), {
      piece: pieceOf({ conservation_status: "restricted" }),
    });
    expect(
      screen.getByText(
        "The creator has asked that this work isn’t recorded or shared."
      )
    ).toBeVisible();
  });

  it("pages the history without reloading the piece", async () => {
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
      "/pieces/the-copper-kettle/history?page=3"
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
    [{ kind: "not_found" }, 404, "We couldn’t find that piece"],
    [{ kind: "resting", retryAfter: 30 }, 503, "Bardic Torch is resting"],
  ])("shows a %j failure under the head", async (failure, status, title) => {
    await renderHistory(() => {
      throw data(failure, { status });
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "The Copper Kettle" })
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: title })).toBeVisible();
  });

  it("renders the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() => renderHistory(pages(2)));
  });
});
