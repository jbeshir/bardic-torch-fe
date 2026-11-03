import { act, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "~/components/ui/Toast";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { Header } from "./Header";

function renderHeader() {
  // The theme toggle in the header reports offline saves in a toast.
  return renderWithRouter(
    <ToastProvider>
      <Header
        menu={<button type="button">Menu</button>}
        account={<a href="/auth/login">Log in</a>}
        bottomBar={<div data-bar>Bottom bar</div>}
      />
    </ToastProvider>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Header", () => {
  it("is the banner, with a home link named by the wordmark whose flame flickers on hover", async () => {
    await renderHeader();
    const banner = screen.getByRole("banner");
    const home = within(banner).getByRole("link", { name: "Bardic Torch" });
    expect(home).toHaveAttribute("href", "/");
    expect(home).toHaveClass("group", "min-h-11");
    expect(home.querySelector(".origin-flame")).toHaveClass(
      "motion-safe:group-hover:animate-flicker"
    );
  });

  it("holds the menu (md–lg only), the wiki search, the theme toggle and the account control from md", async () => {
    await renderHeader();
    const banner = screen.getByRole("banner");
    const menu = within(banner).getByRole("button", { name: "Menu" });
    expect(menu.parentElement).toHaveClass("hidden", "md:block", "lg:hidden");
    const search = within(banner).getByRole("search");
    expect(search.parentElement).toHaveClass("hidden", "md:block");
    const theme = within(banner).getByRole("group", { name: "Theme" });
    const tools = theme.closest(".md\\:flex");
    expect(tools).toHaveClass("hidden");
    expect(
      within(tools as HTMLElement).getByRole("link", { name: "Log in" })
    ).toBeInTheDocument();
  });

  it("keeps the bottom app bar inside the banner, after the top row", async () => {
    await renderHeader();
    const banner = screen.getByRole("banner");
    expect(banner.lastElementChild).toHaveAttribute("data-bar");
  });

  it("gets a shadow once the page scrolls away from the top", async () => {
    let report: (entries: { isIntersecting: boolean }[]) => void = () =>
      undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: typeof report) {
          report = callback;
        }
        observe() {}
        disconnect() {}
      }
    );
    await renderHeader();
    const banner = screen.getByRole("banner");
    expect(banner).toHaveClass("shadow-none");
    act(() => report([{ isIntersecting: false }]));
    expect(banner).toHaveClass("shadow-1");
    act(() => report([{ isIntersecting: true }]));
    expect(banner).toHaveClass("shadow-none");
    // A batch is oldest first: the page left the top after the first report.
    act(() => report([{ isIntersecting: true }, { isIntersecting: false }]));
    expect(banner).toHaveClass("shadow-1");
    act(() => report([{ isIntersecting: false }, { isIntersecting: true }]));
    expect(banner).toHaveClass("shadow-none");
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(renderHeader);
  });
});
