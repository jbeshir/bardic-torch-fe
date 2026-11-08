import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { SelectedFilters } from "./SelectedFilters";

const CHIPS = [
  { label: "Search: ‘kettle’", href: "/pieces?letter=W" },
  { label: "Letter: W", href: "/pieces?q=kettle" },
];

function renderChips(chips = CHIPS) {
  return renderWithRouter(
    <SelectedFilters chips={chips} clearHref="/pieces" />,
    "/pieces?q=kettle&letter=W"
  );
}

describe("SelectedFilters", () => {
  it("lists each value as a link to the list without it, under a hidden heading", async () => {
    await renderChips();
    const region = screen.getByRole("region", { name: "Selected filters" });
    const links = within(region).getAllByRole("link");
    expect(links.map(link => link.textContent)).toEqual([
      "Remove Search: ‘kettle’",
      "Remove Letter: W",
      "Clear all",
    ]);
    expect(links.map(link => link.getAttribute("href"))).toEqual([
      "/pieces?letter=W",
      "/pieces?q=kettle",
      "/pieces",
    ]);
  });

  it("tells crawlers not to follow the combinations", async () => {
    await renderChips();
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("rel", "nofollow");
    }
  });

  it("shows nothing when nothing is selected", async () => {
    await renderChips([]);
    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("removes a value from the keyboard", async () => {
    const user = userEvent.setup();
    const router = await renderChips();
    await user.tab();
    expect(
      screen.getByRole("link", { name: "Remove Search: ‘kettle’" })
    ).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(router.state.location.search).toBe("?letter=W");
  });

  it("has the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() => renderChips());
  });
});
