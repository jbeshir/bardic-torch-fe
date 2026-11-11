import { describe, expect, it } from "vitest";
import { ignoreSearchChanges } from "./entity-route";

const args = (
  current: string,
  next: string,
  defaultShouldRevalidate = true
) => ({
  currentUrl: new URL(`https://app.test${current}`),
  currentParams: {},
  nextUrl: new URL(`https://app.test${next}`),
  nextParams: {},
  defaultShouldRevalidate,
});

describe("ignoreSearchChanges", () => {
  it.each([
    ["/categories/x", "/categories/x?page=2", true, false],
    ["/categories/x", "/categories/x", true, true],
    ["/categories/x", "/categories/y", true, true],
    ["/categories/x", "/categories/x/history", false, false],
  ])("%s to %s (default %s) is %s", (from, to, dflt, expected) => {
    expect(ignoreSearchChanges(args(from, to, dflt))).toBe(expected);
  });
});
