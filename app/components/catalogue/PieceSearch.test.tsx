import { screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { pieceQuery } from "~/catalogue/query-state";
import { renderOnServer, renderRoutes, renderWithRouter } from "~/test/router";
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
  /** The order beside a stand-in facet form it belongs to. */
  const withForm = (search: string) => (
    <>
      <form id="facets" method="get" action="/pieces">
        <button type="submit">Apply filters</button>
      </form>
      <PieceSort state={stateOf(search)} form="facets" />
    </>
  );

  it("offers best match and title order, belonging to the facet form", async () => {
    await renderWithRouter(withForm(FILTERED));
    const select = screen.getByRole("combobox", { name: "Sort by" });
    expect(select).toHaveValue("title");
    expect(select).toHaveAttribute("name", "sort");
    expect(select).toHaveAttribute("form", "facets");
    expect(
      within(select)
        .getAllByRole("option")
        .map(option => option.textContent)
    ).toEqual(["Best match", "Title A–Z"]);
    // With JS a change applies it, so there is no button.
    expect(screen.queryByRole("button", { name: "Sort" })).toBeNull();
  });

  it("applies a new order at once with JS, from the first page, keeping the rest", async () => {
    const user = userEvent.setup();
    const router = await renderOnPage("?q=kettle&kind=song&page=3", withForm);
    const select = screen.getByRole("combobox", { name: "Sort by" });
    expect(select).toHaveValue("");
    await user.selectOptions(select, "title");
    expect(router.state.location.search).toBe("?q=kettle&kind=song&sort=title");
  });

  it("drops the order for best match, the default", async () => {
    const user = userEvent.setup();
    const router = await renderOnPage("?q=kettle&sort=title", withForm);
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Sort by" }),
      "Best match"
    );
    expect(router.state.location.search).toBe("?q=kettle");
  });

  it("has a Sort button without JS, which submits the facet form", async () => {
    const page = document.createElement("div");
    page.innerHTML = await renderOnServer(withForm("?q=kettle"), "/pieces");
    const button = [...page.querySelectorAll("button")].find(
      element => element.textContent === "Sort"
    );
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveAttribute("form", "facets");
  });

  it("has the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(withForm("?q=kettle"))
    );
  });
});
