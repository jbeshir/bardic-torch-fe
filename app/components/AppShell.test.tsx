import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Outlet, useLocation } from "react-router";
import { ErrorState } from "~/components/ui/ErrorState";
import { ToastProvider } from "~/components/ui/Toast";
import { renderRoutes, renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { AppShell, type PageHandle } from "./AppShell";

function renderShell(url = "/") {
  // As in root.tsx: the shell's theme toggles report offline saves in a toast.
  return renderWithRouter(
    <ToastProvider>
      <AppShell account={{ state: "signed-out" }}>
        <h1>Page title</h1>
        <button type="button">Elsewhere</button>
      </AppShell>
    </ToastProvider>,
    url
  );
}

/** The shell around a route's page, as root.tsx renders it. */
function ShellOutlet() {
  return (
    <ToastProvider>
      <AppShell account={{ state: "signed-out" }}>
        <Outlet />
      </AppShell>
    </ToastProvider>
  );
}

function Elsewhere() {
  return <button type="button">Elsewhere</button>;
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
    // Kept for screen readers at lg, so the group headings (h3) have an h2.
    expect(
      within(nav).getByRole("heading", { level: 2, name: "Site menu" })
    ).toHaveClass("lg:sr-only");
    expect(screen.getAllByRole("navigation", { name: "Site" })).toHaveLength(1);
  });

  it("is at least the window's height, with the sheet only as tall as its content from lg", async () => {
    await renderShell();
    const main = screen.getByRole("main");
    expect(main).toHaveClass("flex-1", "lg:self-start");
    expect(main.parentElement).toHaveClass(
      "flex-1",
      "flex-col",
      "lg:grid-rows-shell"
    );
    expect(main.parentElement?.parentElement).toHaveClass(
      "min-h-dvh",
      "flex",
      "flex-col"
    );
  });

  it("brings the current page into view in a sidebar taller than the window, scrolling only the sidebar", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo");
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(
      1100
    );
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(736);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(32);
    const original = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      if (this.getAttribute("aria-current") === "page") {
        return { top: 64 + 900 } as DOMRect;
      }
      if (this.id === "site-nav") return { top: 64 } as DOMRect;
      return original.call(this);
    };
    try {
      await renderShell("/help/licence");
      const nav = screen.getByRole("navigation", { name: "Site" });
      // 900 + 32 - 736 + 24 + 16: the item's foot clear of the 24 px fade,
      // with a margin.
      expect(nav.scrollTop).toBe(236);
      expect(scrollTo).not.toHaveBeenCalled();
      // More below the fold: the fade shows (from lg).
      expect(screen.getByTestId("sidebar-more")).toHaveClass("lg:block");
    } finally {
      HTMLElement.prototype.getBoundingClientRect = original;
      vi.restoreAllMocks();
    }
  });

  it("after a client navigation, focuses the main content and announces the new title", async () => {
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
      callback();
      return 0;
    });
    try {
      const router = await renderShell("/help/licence");
      const main = screen.getByRole("main");
      const status = screen
        .getAllByRole("status")
        .find(element => element.classList.contains("sr-only"));
      // The document load is left alone.
      expect(main).not.toHaveFocus();
      expect(status).toHaveTextContent("");
      document.title = "FAQ for bards · Bardic Torch";
      await act(() => router.navigate("/help/faq-for-bards"));
      expect(main).toHaveFocus();
      expect(status).toHaveTextContent("FAQ for bards · Bardic Torch");
      // A jump within the page isn't a new page.
      screen.getByRole("button", { name: "Elsewhere" }).focus();
      await act(() => router.navigate("/help/faq-for-bards#opt-out"));
      expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("leaves focus on an error page's heading after a client navigation", async () => {
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
      callback();
      return 0;
    });
    function Page() {
      const { pathname } = useLocation();
      return pathname === "/missing" ? (
        <ErrorState title="Page not found" actions={null}>
          That page isn’t here.
        </ErrorState>
      ) : (
        <h1>Page title</h1>
      );
    }
    try {
      const router = await renderWithRouter(
        <ToastProvider>
          <AppShell account={{ state: "signed-out" }}>
            <Page />
          </AppShell>
        </ToastProvider>,
        "/help/licence"
      );
      await act(() => router.navigate("/missing"));
      expect(
        screen.getByRole("heading", { level: 1, name: "Page not found" })
      ).toHaveFocus();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("still moves focus to the main content when the focused control inside it stays on the new page", async () => {
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
      callback();
      return 0;
    });
    try {
      const router = await renderShell("/help/licence");
      // The same button is rendered on both pages, keeping its focus.
      screen.getByRole("button", { name: "Elsewhere" }).focus();
      await act(() => router.navigate("/help/faq-for-bards"));
      expect(screen.getByRole("main")).toHaveFocus();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("treats a change of the query part a route names as a new page", async () => {
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
      callback();
      return 0;
    });
    const handle: PageHandle = {
      pageKey: search => search.get("facet") ?? "",
    };
    const router = await renderRoutes(
      [
        {
          path: "/",
          Component: ShellOutlet,
          HydrateFallback: () => null,
          children: [{ path: "categories", handle, Component: Elsewhere }],
        },
      ],
      "/categories?facet=mood"
    );
    const main = screen.getByRole("main");
    // Another facet is another page: focus to the main content.
    screen.getByRole("button", { name: "Elsewhere" }).focus();
    await act(() => router.navigate("/categories?facet=topic"));
    expect(main).toHaveFocus();
    // Any other part of the query is the same page.
    screen.getByRole("button", { name: "Elsewhere" }).focus();
    await act(() => router.navigate("/categories?facet=topic&x=1"));
    expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus();
  });

  it("shows no fade when the whole sidebar fits", async () => {
    await renderShell();
    expect(screen.getByTestId("sidebar-more")).not.toHaveClass("lg:block");
  });

  it("offers the search and the theme in the site menu below md, where the header has neither", async () => {
    await renderShell();
    const nav = screen.getByRole("navigation", { name: "Site" });
    expect(
      within(nav).getByRole("search").closest(".md\\:hidden")
    ).not.toBeNull();
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
    // Its toggle is for below md only: from md the header has one, and a
    // page never shows two (DESIGN §6.24).
    expect(
      within(dialog)
        .getByRole("group", { name: "Theme" })
        .closest(".md\\:hidden")
    ).not.toBeNull();
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
