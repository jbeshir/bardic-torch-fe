import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// Builds replace `__STUB_AUTH__` at compile time; tests start without stub
// auth and opt in with `vi.stubGlobal("__STUB_AUTH__", true)`.
beforeEach(() => {
  vi.stubGlobal("__STUB_AUTH__", false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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
