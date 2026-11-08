import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BELOW_SM_QUERY, LG_QUERY, MD_QUERY, XL_QUERY } from "./breakpoints";

// The scripts' media queries are the CSS's breakpoints (tokens.css), so a
// script switches exactly where the layout does.

const css = readFileSync("app/styles/tokens.css", "utf8");

function breakpoint(name: string): number {
  const value = new RegExp(`--breakpoint-${name}: (\\d+)px;`).exec(css)?.[1];
  if (value === undefined) throw new Error(`no --breakpoint-${name}`);
  return Number(value);
}

describe("breakpoints", () => {
  it("are the CSS's", () => {
    expect(MD_QUERY).toBe(`(min-width: ${breakpoint("md")}px)`);
    expect(LG_QUERY).toBe(`(min-width: ${breakpoint("lg")}px)`);
    expect(XL_QUERY).toBe(`(min-width: ${breakpoint("xl")}px)`);
    expect(BELOW_SM_QUERY).toBe(`(max-width: ${breakpoint("sm") - 1}px)`);
  });
});
