import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { AppShell } from "./AppShell";

function renderShell(url = "/") {
  return renderWithRouter(
    <AppShell>
      <h1>Page title</h1>
    </AppShell>,
    url
  );
}

describe("AppShell", () => {
  it("has one banner, main, Site nav and contentinfo, in that DOM order", async () => {
    await renderShell();
    const banner = screen.getByRole("banner");
    const main = screen.getByRole("main");
    const nav = screen.getByRole("navigation", { name: "Site" });
    const footer = screen.getByRole("contentinfo");
    const order = [banner, main, nav, footer].map(element =>
      [...document.querySelectorAll("header, main, nav, footer")].indexOf(
        element
      )
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(within(main).getByRole("heading", { level: 1 })).toHaveTextContent(
      "Page title"
    );
    expect(main.contains(nav)).toBe(false);
  });

  it("starts with a skip link to the main content, which can take focus", async () => {
    const user = userEvent.setup();
    await renderShell();
    await user.tab();
    const skip = screen.getByRole("link", { name: "Skip to content" });
    expect(skip).toHaveFocus();
    expect(skip).toHaveAttribute("href", "#content");
    expect(skip).toHaveClass("sr-only", "focus:not-sr-only");
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "content");
    expect(main).toHaveAttribute("tabindex", "-1");
  });

  it("places the one Site nav as the sidebar from lg and the site menu below it", async () => {
    await renderShell();
    const nav = screen.getByRole("navigation", { name: "Site" });
    expect(nav).toHaveAttribute("id", "site-nav");
    expect(nav).toHaveClass("lg:col-start-1", "lg:row-start-1", "lg:sticky");
    expect(
      within(nav).getByRole("heading", { level: 2, name: "Site menu" })
        .parentElement
    ).toHaveClass("lg:hidden");
    expect(screen.getAllByRole("navigation", { name: "Site" })).toHaveLength(1);
  });

  it("offers the search and the theme in the site menu below md, where the header has neither", async () => {
    await renderShell();
    const nav = screen.getByRole("navigation", { name: "Site" });
    expect(within(nav).getByRole("search").parentElement).toHaveClass(
      "md:hidden"
    );
    expect(
      within(nav).getByRole("group", { name: "Theme" }).closest(".md\\:hidden")
    ).not.toBeNull();
  });

  it("is not busy when nothing is loading", async () => {
    await renderShell();
    expect(screen.getByRole("main")).not.toHaveAttribute("aria-busy");
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(() => renderShell("/help"));
  });
});
