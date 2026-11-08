import { screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { pieceQuery } from "~/catalogue/query-state";
import { renderRoutes, renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { PieceSearch, PieceSort } from "./PieceSearch";

const stateOf = (search: string) =>
  pieceQuery.parse(new URLSearchParams(search)).state;

const FILTERED =
  "?q=kettle&term=war&kind=song&status=endangered&stub=false&letter=W&sort=title&page=2";

function hidden(form: HTMLElement) {
  return [
    ...form.querySelectorAll<HTMLInputElement>('input[type="hidden"]'),
  ].map(input => [input.name, input.value]);
}

/** The search box on a /pieces route, to follow its submit. */
function renderOnPage(search: string, ui: (s: string) => ReactNode) {
  return renderRoutes(
    [
      {
        path: "/pieces",
        element: ui(search),
        HydrateFallback: () => null,
      },
    ],
    `/pieces${search}`
  );
}

describe("PieceSearch", () => {
  it("is a search landmark: a named field and a Search button", async () => {
    await renderWithRouter(<PieceSearch state={stateOf("?q=kettle")} />);
    const form = screen.getByRole("search", { name: "Pieces" });
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/pieces");
    const box = within(form).getByRole("searchbox", { name: "Search pieces" });
    expect(box).toHaveAttribute("name", "q");
    expect(box).toHaveValue("kettle");
    expect(box).toHaveClass("min-h-11");
    expect(
      within(form).getByRole("button", { name: "Search" })
    ).toHaveAttribute("type", "submit");
  });

  it("keeps the filters and drops the letter, the order and the page", async () => {
    await renderWithRouter(<PieceSearch state={stateOf(FILTERED)} />);
    expect(hidden(screen.getByRole("search"))).toEqual([
      ["term", "war"],
      ["kind", "song"],
      ["status", "endangered"],
      ["stub", "false"],
    ]);
  });

  it("has no hidden inputs with nothing set", async () => {
    await renderWithRouter(<PieceSearch state={stateOf("?letter=W")} />);
    expect(hidden(screen.getByRole("search"))).toEqual([]);
  });

  it("goes straight to the canonical URL when submitted with JS", async () => {
    const user = userEvent.setup();
    const router = await renderOnPage("?letter=W&kind=song", search => (
      <PieceSearch state={stateOf(search)} />
    ));
    await user.type(
      screen.getByRole("searchbox", { name: "Search pieces" }),
      "  copper kettle {Enter}"
    );
    expect(router.state.location.search).toBe("?q=copper+kettle&kind=song");
  });

  it("clears the search when submitted empty", async () => {
    const user = userEvent.setup();
    const router = await renderOnPage("?q=kettle", search => (
      <PieceSearch state={stateOf(search)} />
    ));
    await user.clear(screen.getByRole("searchbox", { name: "Search pieces" }));
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(router.state.location.search).toBe("");
  });

  it("has the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(<PieceSearch state={stateOf(FILTERED)} />)
    );
  });
});

describe("PieceSort", () => {
  it("offers best match and title order, keeping the rest of the state", async () => {
    await renderWithRouter(<PieceSort state={stateOf(FILTERED)} />);
    const select = screen.getByRole("combobox", { name: "Sort by" });
    expect(select).toHaveValue("title");
    expect(
      within(select)
        .getAllByRole("option")
        .map(option => option.textContent)
    ).toEqual(["Best match", "Title A–Z"]);
    const form = select.closest("form");
    if (!form) throw new Error("no form");
    expect(hidden(form)).toEqual([
      ["q", "kettle"],
      ["term", "war"],
      ["kind", "song"],
      ["status", "endangered"],
      ["stub", "false"],
      ["letter", "W"],
    ]);
  });

  it("applies the order when submitted, from the first page", async () => {
    const user = userEvent.setup();
    const router = await renderOnPage("?q=kettle&page=3", search => (
      <PieceSort state={stateOf(search)} />
    ));
    const select = screen.getByRole("combobox", { name: "Sort by" });
    expect(select).toHaveValue("relevance");
    await user.selectOptions(select, "title");
    // Never on change: only Sort applies it.
    expect(router.state.location.search).toBe("?q=kettle&page=3");
    await user.click(screen.getByRole("button", { name: "Sort" }));
    expect(router.state.location.search).toBe("?q=kettle&sort=title");
  });

  it("drops the order for best match, the default", async () => {
    const user = userEvent.setup();
    const router = await renderOnPage("?q=kettle&sort=title", search => (
      <PieceSort state={stateOf(search)} />
    ));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Sort by" }),
      "relevance"
    );
    await user.click(screen.getByRole("button", { name: "Sort" }));
    expect(router.state.location.search).toBe("?q=kettle");
  });

  it("has the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(<PieceSort state={stateOf("?q=kettle")} />)
    );
  });
});
