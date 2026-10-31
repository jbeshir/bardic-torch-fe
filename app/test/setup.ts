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
