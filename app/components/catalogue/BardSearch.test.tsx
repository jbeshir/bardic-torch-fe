import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { personQuery } from "~/catalogue/query-state";
import { renderRoutes, renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { BardSearch } from "./BardSearch";

// The bards' search box, on the shared CatalogueSearch: its landmark, the
// state it keeps, and a search by keyboard straight to the canonical URL.

const stateOf = (search: string) =>
  personQuery.parse(new URLSearchParams(search)).state;

describe("BardSearch", () => {
  it("is the Bards search landmark, keeping the filters and dropping the letter and page", async () => {
    await renderWithRouter(
      <BardSearch
        state={stateOf(
          "?q=wren&kind=group&affiliation=caer-wyn&letter=W&page=2"
        )}
      />
    );
    const form = screen.getByRole("search", { name: "Bards" });
    expect(form).toHaveAttribute("action", "/bards");
    expect(
      within(form).getByRole("searchbox", { name: "Search bards" })
    ).toHaveValue("wren");
    expect(
      [...form.querySelectorAll<HTMLInputElement>('input[type="hidden"]')].map(
        input => [input.name, input.value]
      )
    ).toEqual([
      ["kind", "group"],
      ["affiliation", "caer-wyn"],
    ]);
  });

  it("searches with Enter, straight to the canonical URL", async () => {
    const router = await renderRoutes(
      [
        {
          path: "/bards",
          element: <BardSearch state={stateOf("?kind=group&letter=W")} />,
          HydrateFallback: () => null,
        },
      ],
      "/bards?kind=group&letter=W"
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("searchbox", { name: "Search bards" }));
    await user.keyboard("  wren {Enter}");
    expect(router.state.location.search).toBe("?q=wren&kind=group");
  });

  it("has the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(<BardSearch state={stateOf("?q=wren")} />)
    );
  });
});
