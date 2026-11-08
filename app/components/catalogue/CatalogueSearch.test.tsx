import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { personQuery, pieceQuery } from "~/catalogue/query-state";
import { renderRoutes } from "~/test/router";
import { BardSearch } from "./BardSearch";
import { PieceSearch } from "./PieceSearch";

// The two directory search boxes are one component (CatalogueSearch), so
// they must behave and look alike (DESIGN §10.7, §10.10): the same field,
// button and keyboard, run here against both.

/** A search box that follows the URL, as its route renders it. */
type Box = (search: string) => ReactNode;

const BOXES: readonly {
  readonly path: string;
  readonly landmark: string;
  readonly label: string;
  readonly box: Box;
}[] = [
  {
    path: "/pieces",
    landmark: "Pieces",
    label: "Search pieces",
    box: search => (
      <PieceSearch
        state={pieceQuery.parse(new URLSearchParams(search)).state}
      />
    ),
  },
  {
    path: "/bards",
    landmark: "Bards",
    label: "Search bards",
    box: search => (
      <BardSearch
        state={personQuery.parse(new URLSearchParams(search)).state}
      />
    ),
  },
];

describe.each(BOXES)(
  "the $landmark search box",
  ({ path, landmark, label, box }) => {
    function Page() {
      const { search } = useLocation();
      return (
        <>
          {box(search)}
          {/* A stand-in for the "Search: ‘…’ ✕" chip. */}
          <Link to={path}>Remove search</Link>
        </>
      );
    }

    const renderPage = (search: string) =>
      renderRoutes(
        [{ path, Component: Page, HydrateFallback: () => null }],
        `${path}${search}`
      );

    const field = () => screen.getByRole("searchbox", { name: label });

    it("has a named 44 px field with a search glass, no placeholder, and a secondary Search button", async () => {
      await renderPage("?q=wren");
      const form = screen.getByRole("search", { name: landmark });
      expect(form).toHaveAttribute("method", "get");
      expect(form).toHaveAttribute("action", path);
      expect(field()).toHaveAttribute("name", "q");
      expect(field()).toHaveValue("wren");
      expect(field()).toHaveClass("min-h-11", "pl-10");
      expect(field()).not.toHaveAttribute("placeholder");
      expect(field()).toHaveAttribute("enterkeyhint", "search");
      expect(field()).toHaveAttribute("autocomplete", "off");
      const button = within(form).getByRole("button", { name: "Search" });
      expect(button).toHaveAttribute("type", "submit");
      expect(button).toHaveClass("min-h-11", "border-border-strong");
    });

    it("searches with Enter and keeps focus in the field", async () => {
      const user = userEvent.setup();
      const router = await renderPage("");
      await user.click(field());
      await user.keyboard("  wren {Enter}");
      expect(router.state.location.search).toBe("?q=wren");
      expect(field()).toHaveFocus();
      expect(field()).toHaveValue("wren");
    });

    it("empties the field with Escape, staying on the page, then drops the search with Enter", async () => {
      const user = userEvent.setup();
      const router = await renderPage("?q=wren");
      await user.click(field());
      await user.keyboard("{Escape}");
      expect(field()).toHaveValue("");
      expect(field()).toHaveFocus();
      expect(router.state.location.search).toBe("?q=wren");
      await user.keyboard("{Enter}");
      expect(router.state.location.search).toBe("");
      expect(field()).toHaveFocus();
    });

    it("drops the search when Search is pressed with the field cleared", async () => {
      const user = userEvent.setup();
      const router = await renderPage("?q=wren");
      await user.clear(field());
      await user.click(screen.getByRole("button", { name: "Search" }));
      expect(router.state.location.search).toBe("");
    });

    it("follows the page's search when a chip removes it, even after typing", async () => {
      const user = userEvent.setup();
      const router = await renderPage("");
      await user.type(field(), "wren{Enter}");
      expect(field()).toHaveValue("wren");
      await user.click(screen.getByRole("link", { name: "Remove search" }));
      expect(router.state.location.search).toBe("");
      expect(field()).toHaveValue("");
    });
  }
);
