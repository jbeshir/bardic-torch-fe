import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { Drawer } from "./Drawer";
import { Link } from "./Link";

function Menu({ closeFrom }: { closeFrom?: "lg" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        Menu
      </button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Site menu"
        closeFrom={closeFrom}
        footer={<p>Theme</p>}
      >
        <nav aria-label="Site">
          <Link to="/help">Help</Link>
        </nav>
      </Drawer>
    </>
  );
}

function dialog() {
  return document.querySelector("dialog") as HTMLDialogElement;
}

/** A stand-in for `matchMedia` whose match can be flipped. */
function mockViewport(matches: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches,
    addEventListener: (_: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) =>
      listeners.delete(listener),
  };
  vi.stubGlobal("matchMedia", (text: string) => {
    expect(text).toBe("(min-width: 1024px)");
    return query;
  });
  return {
    grow() {
      query.matches = true;
      for (const listener of listeners) listener();
    },
  };
}

async function openMenu() {
  await userEvent.click(screen.getByRole("button", { name: "Menu" }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Drawer", () => {
  it("opens as a modal named by its visible h2, focus on the close button", async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
    await renderWithRouter(<Menu />);
    await act(openMenu);
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: "Site menu" })).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 2, name: "Site menu" })
    ).toBeVisible();
    const close = screen.getAllByRole("button", { name: "Close menu" })[0];
    expect(close).toHaveFocus();
    expect(close).toHaveClass("min-h-11", "w-11");
  });

  it("has the body, then the footer with a full-width close button", async () => {
    await renderWithRouter(<Menu />);
    await act(openMenu);
    const [, bottomClose] = screen.getAllByRole("button", {
      name: "Close menu",
    });
    expect(bottomClose).toHaveClass("w-full", "border-border-strong");
    expect(bottomClose?.parentElement).toHaveTextContent("Theme");
    expect(
      screen.getByRole("navigation", { name: "Site" }).parentElement
    ).toHaveClass("overflow-y-auto", "min-h-0", "flex-1");
  });

  it("keeps Tab inside, wrapping round", async () => {
    const user = userEvent.setup();
    await renderWithRouter(<Menu />);
    await act(openMenu);
    const [topClose, bottomClose] = screen.getAllByRole("button", {
      name: "Close menu",
    });
    await act(() => user.tab());
    expect(screen.getByRole("link", { name: "Help" })).toHaveFocus();
    await act(() => user.tab());
    expect(bottomClose).toHaveFocus();
    await act(() => user.tab());
    expect(topClose).toHaveFocus();
    await act(() => user.tab({ shift: true }));
    expect(bottomClose).toHaveFocus();
  });

  it.each([
    [
      "Escape",
      () => fireEvent(dialog(), new Event("cancel", { cancelable: true })),
    ],
    [
      "the bottom close button",
      () =>
        fireEvent.click(
          screen.getAllByRole("button", {
            name: "Close menu",
          })[1] as HTMLElement
        ),
    ],
    [
      "the backdrop",
      () => {
        fireEvent.pointerDown(dialog());
        fireEvent.click(dialog());
      },
    ],
  ])(
    "closes with %s and returns focus to the menu button",
    async (_how, closeIt) => {
      await renderWithRouter(<Menu />);
      await act(openMenu);
      act(() => {
        closeIt();
      });
      expect(dialog().open).toBe(false);
      expect(screen.getByRole("button", { name: "Menu" })).toHaveFocus();
    }
  );

  it("closes when a link inside navigates", async () => {
    const user = userEvent.setup();
    const router = await renderWithRouter(<Menu />);
    await act(openMenu);
    await act(() => user.click(screen.getByRole("link", { name: "Help" })));
    expect(router.state.location.pathname).toBe("/help");
    expect(dialog().open).toBe(false);
  });

  it("brings the current page's link into view in a long menu, scrolling only its body", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo");
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(900);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(40);
    const original = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this.getAttribute("aria-current") === "page") {
          return { top: 50 + 700 } as DOMRect;
        }
        if (this.classList.contains("overflow-y-auto")) {
          return { top: 50 } as DOMRect;
        }
        return original.call(this);
      }
    );
    await renderWithRouter(
      <Drawer open onClose={() => {}} title="Site menu">
        <a href="/help/licence" aria-current="page">
          Licence & attribution
        </a>
      </Drawer>
    );
    const link = screen.getByRole("link", { name: "Licence & attribution" });
    // 700 + 40 - 400 + 16: the link's foot, with a margin.
    expect(link.parentElement?.scrollTop).toBe(356);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("locks page scroll while open", async () => {
    await renderWithRouter(<Menu />);
    await act(openMenu);
    expect(document.documentElement).toHaveClass("overflow-hidden");
    act(() => {
      fireEvent(dialog(), new Event("cancel", { cancelable: true }));
    });
    expect(document.documentElement).not.toHaveClass("overflow-hidden");
  });

  it("closes when the viewport reaches lg, if asked", async () => {
    const viewport = mockViewport(false);
    await renderWithRouter(<Menu closeFrom="lg" />);
    await act(openMenu);
    expect(dialog().open).toBe(true);
    act(() => viewport.grow());
    expect(dialog().open).toBe(false);
  });

  it("doesn't open at all when the viewport is already lg, if asked", async () => {
    mockViewport(true);
    await renderWithRouter(<Menu closeFrom="lg" />);
    await act(openMenu);
    expect(dialog().open).toBe(false);
  });

  it("is a bottom sheet below md and a left drawer from md, moving only when motion is allowed", async () => {
    await renderWithRouter(<Menu />);
    expect(dialog()).toHaveClass(
      "bottom-0",
      "max-h-sheet",
      "rounded-t-xl",
      "pb-safe-b",
      "md:top-0",
      "md:h-dvh",
      "md:w-drawer",
      "md:rounded-r-xl",
      "backdrop:bg-scrim-scrim",
      "motion-safe:animate-sheet-in",
      "md:motion-safe:animate-drawer-in",
      "motion-reduce:animate-fade-in"
    );
  });

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(async () => {
      await renderWithRouter(<Menu />);
      await act(openMenu);
    });
  });
});
