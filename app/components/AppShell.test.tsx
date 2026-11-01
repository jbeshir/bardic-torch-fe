import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "~/components/ui/Toast";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { AppShell } from "./AppShell";

function renderShell(url = "/") {
  // As in root.tsx: the shell's theme toggles report offline saves in a toast.
  return renderWithRouter(
    <ToastProvider>
      <AppShell account={{ state: "signed-out" }}>
        <h1>Page title</h1>
      </AppShell>
    </ToastProvider>,
    url
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

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
    // Padding only while focused: unfocused padding would stretch the
    // clipped 1 px box into a 24 × 16 target (border-box), and
    // not-sr-only's padding: 0 would otherwise strip it when focused.
    expect(skip).toHaveClass("focus:px-3", "focus:py-2");
    expect(skip.className).not.toMatch(/(^|\s)p[xy]?-/);
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

  it("once hydrated, hides the site menu below lg and opens the same navigation in the drawer", async () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    const user = userEvent.setup();
    await renderShell("/help/licence");
    const nav = screen.getByRole("navigation", { name: "Site" });
    expect(nav).toHaveClass("hidden", "lg:block");

    const [headerMenu, barMenu] = screen.getAllByRole("button", {
      name: "Menu",
    });
    expect(headerMenu).toHaveAttribute("aria-haspopup", "dialog");
    const drawer = document.querySelector("dialog");
    expect(headerMenu).toHaveAttribute("aria-controls", drawer?.id);
    expect(barMenu).toHaveAttribute("aria-controls", drawer?.id);

    await user.click(barMenu as HTMLElement);
    const dialog = screen.getByRole("dialog", { name: "Site menu" });
    expect(within(dialog).getByRole("search")).toBeInTheDocument();
    expect(
      within(dialog)
        .getByRole("navigation", { name: "Site" })
        .querySelector('[aria-current="page"]')
    ).toHaveTextContent("Licence & attribution");
    expect(
      within(dialog).getByRole("group", { name: "Theme" })
    ).toBeInTheDocument();
    expect(
      within(dialog).getAllByRole("button", { name: "Close menu" })[0]
    ).toHaveFocus();

    await act(() =>
      user.click(
        within(dialog).getAllByRole("button", {
          name: "Close menu",
        })[1] as HTMLElement
      )
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(barMenu).toHaveFocus();
  });

  it("leaves room under the page for the bottom app bar below md", async () => {
    await renderShell();
    expect(screen.getByRole("banner").parentElement).toHaveClass(
      "max-md:pb-app-bar"
    );
  });

  it("is not busy when nothing is loading", async () => {
    await renderShell();
    expect(screen.getByRole("main")).not.toHaveAttribute("aria-busy");
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(() => renderShell("/help"));
  });
});
