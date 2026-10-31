import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { BottomBar, MenuControl } from "./BottomBar";

function renderBar(onOpenMenu = vi.fn()) {
  return renderWithRouter(
    <BottomBar
      account={{ state: "signed-out" }}
      hydrated
      drawerId="drawer"
      siteNavId="site-nav"
      onOpenMenu={onOpenMenu}
    />
  );
}

describe("BottomBar", () => {
  it("is fixed to the bottom below md: Menu, Search and Account in three cells", async () => {
    await renderBar();
    const bar = screen.getByRole("group", { name: "App bar" });
    expect(bar).toHaveClass("bottom-0", "md:hidden", "pb-safe-b");
    expect(bar.firstElementChild).toHaveClass("grid-cols-3", "h-app-bar");
    expect(
      [...(bar.firstElementChild?.children ?? [])]
        .filter(cell => !cell.hasAttribute("hidden"))
        .map(cell => cell.textContent)
    ).toEqual(["Menu", "Search", "Log in"]);
  });

  it("opens the drawer from Menu", async () => {
    const onOpenMenu = vi.fn();
    const user = userEvent.setup();
    await renderBar(onOpenMenu);
    const menu = screen.getByRole("button", { name: "Menu" });
    expect(menu).toHaveAttribute("aria-haspopup", "dialog");
    expect(menu).toHaveAttribute("aria-controls", "drawer");
    await user.click(menu);
    expect(onOpenMenu).toHaveBeenCalledOnce();
  });

  it("opens the search sheet with the field focused; Escape closes it and returns focus", async () => {
    const user = userEvent.setup();
    await renderBar();
    const search = screen.getByRole("button", { name: "Search" });
    expect(search).toHaveAttribute("aria-expanded", "false");
    const sheet = document.getElementById(
      search.getAttribute("aria-controls") ?? ""
    );
    expect(sheet).not.toBeVisible();

    await user.click(search);
    expect(search).toHaveAttribute("aria-expanded", "true");
    expect(sheet).toBeVisible();
    expect(
      screen.getByRole("searchbox", { name: "Search the original wiki" })
    ).toHaveFocus();

    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(sheet).not.toBeVisible();
    expect(search).toHaveFocus();
  });

  it("closes the search sheet with Cancel, returning focus", async () => {
    const user = userEvent.setup();
    await renderBar();
    const search = screen.getByRole("button", { name: "Search" });
    await user.click(search);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(search).toHaveAttribute("aria-expanded", "false");
    expect(search).toHaveFocus();
  });

  it("closes the search sheet when focus moves on past it", async () => {
    const user = userEvent.setup();
    await renderBar();
    const search = screen.getByRole("button", { name: "Search" });
    await user.click(search);
    act(() => screen.getByRole("link", { name: "Log in" }).focus());
    expect(search).toHaveAttribute("aria-expanded", "false");
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(() => renderBar());
  });
});

describe("MenuControl", () => {
  it("before hydration is a link to the site menu after the content", async () => {
    await renderWithRouter(
      <MenuControl
        look="icon"
        hydrated={false}
        drawerId="drawer"
        siteNavId="site-nav"
        onOpen={vi.fn()}
      />
    );
    expect(screen.getByRole("link", { name: "Menu" })).toHaveAttribute(
      "href",
      "#site-nav"
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("in the header is a 44 px icon button with a hidden name", async () => {
    await renderWithRouter(
      <MenuControl
        look="icon"
        hydrated
        drawerId="drawer"
        siteNavId="site-nav"
        onOpen={vi.fn()}
      />
    );
    const button = screen.getByRole("button", { name: "Menu" });
    expect(button).toHaveClass("h-11", "w-11");
    expect(button.querySelector(".sr-only")).toHaveTextContent("Menu");
  });
});
