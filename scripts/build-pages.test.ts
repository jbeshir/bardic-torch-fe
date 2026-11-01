import { describe, it, expect } from "vitest";
import { selectBuildMode } from "./build-pages.mjs";

describe("selectBuildMode", () => {
  it("uses production for the main branch", () => {
    expect(selectBuildMode({ CF_PAGES_BRANCH: "main" })).toBe("production");
  });

  it("uses preview for the preview branch", () => {
    expect(selectBuildMode({ CF_PAGES_BRANCH: "preview" })).toBe("preview");
  });

  it.each([
    "milestone/fe1-foundation",
    "feature/x",
    "Main",
    "master",
    "Preview",
  ])("refuses to build branch %s, naming it", branch => {
    expect(() => selectBuildMode({ CF_PAGES_BRANCH: branch })).toThrow(
      `Branch "${branch}" is not deployed`
    );
  });

  it("fails safe to production when the variable is missing", () => {
    expect(selectBuildMode({})).toBe("production");
  });

  it("fails safe to production when the variable is empty", () => {
    expect(selectBuildMode({ CF_PAGES_BRANCH: "" })).toBe("production");
  });
});
