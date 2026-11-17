import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { personQuery, pieceQuery } from "~/catalogue/query-state";
import { renderRoutes } from "~/test/router";
import { BardSearch } from "./BardSearch";
import { PieceSearch } from "./PieceSearch";

// The two directory search boxes are one component (CatalogueSearch), so
// they must behave and look alike: the same field,
// button and keyboard, run here against both.

/** A search box that follows the URL, as its route renders it. */
type Box = (search: string) => ReactNode;

const BOXES: readonly {
  readonly path: string;
  readonly landmark: string;
  readonly label: string;
  readonly box: Box;
  /** A URL's state: the filters stay in the form, the letter and page go. */
  readonly filtered: string;
  readonly kept: readonly (readonly [string, string])[];
}[] = [
  {
    path: "/pieces",
    landmark: "Pieces",
    label: "Search pieces",
    filtered: "?q=kettle&term=war&kind=song&letter=W&sort=title&page=2",
    kept: [
      ["term", "war"],
      ["kind", "song"],
    ],
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
    filtered: "?q=wren&kind=group&affiliation=caer-wyn&letter=W&page=2",
    kept: [
      ["kind", "group"],
      ["affiliation", "caer-wyn"],
    ],
    box: search => (
      <BardSearch
        state={personQuery.parse(new URLSearchParams(search)).state}
      />
    ),
  },
];

describe.each(BOXES)(
  "the $landmark search box",
  ({ path, landmark, label, box, filtered, kept }) => {
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

    it("is a search landmark keeping the filters, dropping the letter, order and page", async () => {
      await renderPage(filtered);
      const form = screen.getByRole("search", { name: landmark });
      expect(form).toHaveAttribute("action", path);
      expect(field()).toHaveValue(filtered.slice(3).split("&")[0]);
      expect(
        [
          ...form.querySelectorAll<HTMLInputElement>('input[type="hidden"]'),
        ].map(input => [input.name, input.value])
      ).toEqual(kept);
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
