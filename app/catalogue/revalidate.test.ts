import { describe, expect, it } from "vitest";
import { ignoreSearchChanges } from "./revalidate";

function args(current: string, next: string, defaultShouldRevalidate = true) {
  return {
    currentUrl: new URL(`https://app.test${current}`),
    currentParams: {},
    nextUrl: new URL(`https://app.test${next}`),
    nextParams: {},
    defaultShouldRevalidate,
  };
}

describe("ignoreSearchChanges (plan §1)", () => {
  it("leaves the layout be when only the search changes", () => {
    expect(
      ignoreSearchChanges(
        args("/categories/joyful", "/categories/joyful?page=2")
      )
    ).toBe(false);
    expect(
      ignoreSearchChanges(
        args("/categories/x/history?page=2", "/categories/x/history?page=3")
      )
    ).toBe(false);
  });

  it("is the default otherwise", () => {
    // Try again: the same URL, revalidated.
    expect(
      ignoreSearchChanges(args("/categories/x", "/categories/x", true))
    ).toBe(true);
    expect(ignoreSearchChanges(args("/categories/x", "/categories/y"))).toBe(
      true
    );
    expect(
      ignoreSearchChanges(args("/categories/x", "/categories/x/history", false))
    ).toBe(false);
  });
});
