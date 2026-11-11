import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "~/test/router";
import { BottomBar } from "./BottomBar";

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
      screen.getByRole("searchbox", { name: "Search the catalogue" })
    ).toHaveFocus();

    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(sheet).not.toBeVisible();
    expect(search).toHaveFocus();
  });

  it("searches the catalogue from the sheet, which closes on the way", async () => {
    const user = userEvent.setup();
    const router = await renderBar();
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.type(
      screen.getByRole("searchbox", { name: "Search the catalogue" }),
      "kettle{Enter}"
    );
    expect(router.state.location.pathname).toBe("/search");
    expect(router.state.location.search).toBe("?q=kettle");
    expect(screen.getByRole("button", { name: "Search" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
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
});
