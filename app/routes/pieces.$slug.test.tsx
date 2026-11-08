import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { data } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { Piece } from "~/schemas/catalogue";
import { pieceOf, termOf } from "~/test/catalogue";
import { renderRoutes } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import PieceLayout, { ErrorBoundary } from "./pieces.$slug";
import PieceRead from "./pieces.$slug._index";

// A piece's page in the browser, from stubbed loader data: the head, the
// banners, the chips and the licence line of the Read view, and every
// failure the layout's boundary shows. The loader is
// pieces.$slug.ssr.test.ts's; the infobox, PieceInfobox.test.tsx's.

function renderPiece(answer: () => unknown, slug = "the-copper-kettle") {
  return renderRoutes(
    [
      {
        path: "/pieces/:slug",
        loader: () => answer(),
        Component: PieceLayout,
        ErrorBoundary,
        HydrateFallback: () => null,
        children: [{ index: true, Component: PieceRead }],
      },
    ],
    `/pieces/${slug}`
  );
}

const NO_PROSE = {
  notes: null,
  versions: null,
  historicalSource: null,
  licensingNotes: null,
};
const loaded = (piece: Piece) => () => ({ piece, markdown: NO_PROSE });

const RESTRICTED_HISTORY: Piece["conservation_history"] = [
  {
    conservation_status: "restricted",
    reason: "The creator asked.",
    source_url: "https://requests.example/statements/dragons-hoard",
    at: "2026-04-02T12:00:00Z",
  },
];

describe("/pieces/:slug, Read", () => {
  it("has the breadcrumbs, the title, the meta line and the Read and History tabs", async () => {
    await renderPiece(
      loaded(
        pieceOf({
          secondary_kinds: ["dance_music"],
          period_start: 1580,
          period_end: 1600,
        })
      )
    );
    const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(trail).getByRole("link", { name: "Pieces" })).toHaveAttribute(
      "href",
      "/pieces"
    );
    expect(within(trail).getByText("The Copper Kettle")).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "The Copper Kettle" })
    ).toBeVisible();
    expect(screen.getByText("Song · Dance music · 1580–1600")).toHaveClass(
      "text-fg-muted"
    );
    const views = screen.getByRole("navigation", { name: "Page views" });
    expect(within(views).getByRole("link", { name: "Read" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    const history = within(views).getByRole("link", { name: "History" });
    expect(history).toHaveAttribute(
      "href",
      "/pieces/the-copper-kettle/history"
    );
    expect(history).not.toHaveAttribute("aria-current");
    // No Edit tab: editing is FE3.
    expect(within(views).getAllByRole("link")).toHaveLength(2);
  });

  it("reaches the tabs in order with Tab, after the breadcrumbs", async () => {
    const user = userEvent.setup();
    await renderPiece(loaded(pieceOf()));
    await user.tab();
    expect(screen.getByRole("link", { name: "Pieces" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Read" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "History" })).toHaveFocus();
  });

  it("has no banner for a piece that is neither a stub nor restricted", async () => {
    await renderPiece(loaded(pieceOf()));
    expect(screen.queryByText("This page is a stub.")).toBeNull();
    expect(screen.queryByText(/isn’t recorded or shared/)).toBeNull();
  });

  it("says a stub is one, pointing at the contributing guide", async () => {
    await renderPiece(loaded(pieceOf({ is_stub: true })));
    expect(screen.getByText("This page is a stub.")).toBeVisible();
    // The banner's action, and the empty links' (a stub with no links).
    const contribute = screen.getAllByRole("link", {
      name: "How to contribute",
    });
    expect(contribute).toHaveLength(2);
    for (const link of contribute) {
      expect(link).toHaveAttribute("href", "/help/contributing");
    }
  });

  it("shows a restricted piece's banner with the creator's statement, instead of the stub's", async () => {
    await renderPiece(
      loaded(
        pieceOf({
          conservation_status: "restricted",
          is_stub: true,
          conservation_history: RESTRICTED_HISTORY,
        })
      )
    );
    expect(
      screen.getByText(
        "The creator has asked that this work isn’t recorded or shared."
      )
    ).toBeVisible();
    expect(
      screen.getByRole("link", {
        name: "Read their statement (external link)",
      })
    ).toHaveAttribute(
      "href",
      "https://requests.example/statements/dragons-hoard"
    );
    expect(screen.queryByText("This page is a stub.")).toBeNull();
    expect(
      screen.queryByRole("link", { name: "How to contribute" })
    ).toBeNull();
  });

  it("shows a restricted piece's banner without an action when there is no statement", async () => {
    await renderPiece(
      loaded(
        pieceOf({
          conservation_status: "restricted",
          conservation_history: [
            { ...RESTRICTED_HISTORY[0]!, source_url: null },
          ],
        })
      )
    );
    expect(screen.getByText("Please respect their wishes.")).toBeVisible();
    expect(screen.queryByRole("link", { name: /statement/ })).toBeNull();
  });

  it("lists every term as a chip named by its facet", async () => {
    await renderPiece(
      loaded(
        pieceOf({
          terms: [
            termOf("singalong", "mood", "Singalong"),
            termOf("drinking", "topic", "Drinking"),
          ],
        })
      )
    );
    const chips = within(
      screen.getByRole("navigation", { name: "Categories" })
    ).getAllByRole("link");
    expect(chips.map(chip => chip.textContent)).toEqual([
      "Mood: Singalong",
      "Topic: Drinking",
    ]);
    expect(chips[0]).toHaveAttribute("href", "/categories/singalong");
    expect(screen.queryByRole("button", { name: /Show all/ })).toBeNull();
  });

  it("shows the first 12 of 15 chips, and the rest by keyboard", async () => {
    const user = userEvent.setup();
    const terms = Array.from({ length: 15 }, (_, i) =>
      termOf(`topic-${i + 1}`, "topic", `Topic ${i + 1}`)
    );
    await renderPiece(loaded(pieceOf({ terms })));
    const categories = screen.getByRole("navigation", { name: "Categories" });
    expect(within(categories).getAllByRole("link")).toHaveLength(12);
    const more = within(categories).getByRole("button", {
      name: "Show all 15",
    });
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(
      document.getElementById(more.getAttribute("aria-controls") ?? "")
    ).toBe(within(categories).getByRole("list"));
    more.focus();
    await user.keyboard("{Enter}");
    expect(within(categories).getAllByRole("link")).toHaveLength(15);
    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(more).toHaveFocus();
  });

  it("renders the Markdown sections from the loader's trees, leaving out empty ones", async () => {
    const paragraph = (value: string) => [
      {
        type: "paragraph" as const,
        children: [{ type: "text" as const, value }],
      },
    ];
    await renderPiece(() => ({
      piece: pieceOf(),
      markdown: {
        notes: paragraph("A drinking song."),
        versions: null,
        historicalSource: paragraph("A broadside of 1590."),
        licensingNotes: null,
      },
    }));
    expect(screen.getByRole("region", { name: "Notes" })).toHaveTextContent(
      "A drinking song."
    );
    expect(
      screen.getByRole("region", { name: "Historical source" })
    ).toHaveTextContent("A broadside of 1590.");
    expect(screen.queryByRole("heading", { name: "Versions" })).toBeNull();
  });

  it("ends with the licence line, crediting the page history", async () => {
    await renderPiece(loaded(pieceOf()));
    const line = screen.getByText(/^Text is available under the/);
    expect(line).toHaveTextContent(
      "Text is available under the Creative Commons Attribution-ShareAlike 4.0 (external link) licence. This page may be adapted from the original Bardic Torch wiki; its contributors are credited in the page history."
    );
    expect(
      within(line).getByRole("link", { name: "page history" })
    ).toHaveAttribute("href", "/pieces/the-copper-kettle/history");
  });

  it("has the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderPiece(
        loaded(
          pieceOf({
            is_stub: true,
            terms: [termOf("singalong", "mood", "Singalong")],
          })
        )
      )
    );
  });
});

describe("/pieces/:slug failures", () => {
  it.each([
    [{ kind: "not_found" }, 404, "We couldn’t find that piece"],
    [{ kind: "server" }, 500, "We couldn’t load this piece"],
    [{ kind: "resting", retryAfter: 60 }, 503, "Bardic Torch is resting"],
    [{ kind: "bad_gateway" }, 502, "Something went wrong"],
  ])("shows %o as “%s”", async (failure, status, title) => {
    await renderPiece(() => {
      throw data(failure, { status });
    });
    expect(
      screen.getByRole("heading", { level: 1, name: title })
    ).toBeVisible();
  });

  it("offers the way home and the original wiki on a 404", async () => {
    await renderPiece(() => {
      throw data({ kind: "not_found" }, { status: 404 });
    }, "the-lost-lay");
    expect(
      screen.getByRole("link", { name: "Go to the home page" })
    ).toHaveAttribute("href", "/");
    expect(
      screen
        .getByRole("link", {
          name: "Look on the original wiki (opens original wiki)",
        })
        .getAttribute("href")
    ).toMatch(/the(\+|%20)lost(\+|%20)lay/);
  });

  it("shows anything else thrown as a server error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await renderPiece(() => {
      throw new Error("boom");
    });
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "We couldn’t load this piece",
      })
    ).toBeVisible();
    vi.restoreAllMocks();
  });
});
