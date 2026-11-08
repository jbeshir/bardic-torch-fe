import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// Builds replace `__STUB_AUTH__` at compile time; tests start without stub
// auth and opt in with `vi.stubGlobal("__STUB_AUTH__", true)`.
beforeEach(() => {
  vi.stubGlobal("__STUB_AUTH__", false);
  // jsdom has no matchMedia; components see a narrow screen that never
  // changes, unless a test stubs its own.
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia !== "function"
  ) {
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  }
});

// React warns (console.error) about an empty href, which is what an
// unresolved stylesheet URL renders. Fail on it, so it can't come back.
const consoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].includes("An empty string")) {
    throw new Error(args[0]);
  }
  consoleError(...args);
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// Accessible names keep their word breaks, as in a browser. Testing Library's
// name algorithm (dom-accessibility-api) trims the text of every child
// element and only puts a space between children that aren't
// `display: inline`, so `Moods<span> (optional)</span>` and `4.0<span
// class="sr-only"> (external link)</span>` lose their space, which Chromium
// and Playwright keep. jsdom up to 29 computed no `display`, so every child
// was separated; jsdom 30 computes the HTML default, `inline`. This restores
// the old separation for inline phrasing elements (the `hidden` attribute is
// still honoured: both libraries check it before the style).
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `:where(a, abbr, b, cite, code, em, i, kbd, label, mark, q, s, small, span, strong, sub, sup, time, u):not([hidden]) { display: inline-block; }`;
  document.head.appendChild(style);
}

// jsdom has no showModal() or close(). This stand-in keeps the `open` state
// and fires `close`, so the dialog components can be unit-tested; the real
// top layer, inert background and Escape are covered by the styleguide e2e.
if (
  typeof HTMLDialogElement !== "undefined" &&
  !("showModal" in HTMLDialogElement.prototype)
) {
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) {
      if (this.open) {
        throw new DOMException(
          "The dialog is already open.",
          "InvalidStateError"
        );
      }
      this.open = true;
    },
    close(this: HTMLDialogElement) {
      if (!this.open) return;
      this.open = false;
      this.dispatchEvent(new Event("close"));
    },
  });
}
