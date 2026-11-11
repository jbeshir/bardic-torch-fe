import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEME_COLOURS } from "./theme-colour";
import {
  channelString,
  COLOURS,
  resolveColour,
  type ColourName,
} from "./tokens";

const HEX = /^#[0-9A-F]{6}$/;
const names = Object.keys(COLOURS.light) as ColourName[];
const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");

/** The declarations of the first block in `css` opened by `selector`. */
function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `block ${selector}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  // Prettier may wrap long values, so compare with whitespace collapsed.
  return css.slice(open + 1, css.indexOf("}", open)).replace(/\s+/g, " ");
}

describe("colour tokens", () => {
  it("define the same tokens in both themes", () => {
    expect(Object.keys(COLOURS.dark).sort()).toEqual([...names].sort());
    expect(names.length).toBeGreaterThan(50);
  });

  it.each(["light", "dark"] as const)(
    "give every token a #RRGGBB value or an alias to a plain token in %s",
    theme => {
      for (const name of names) {
        const value = COLOURS[theme][name];
        if (typeof value !== "string") {
          expect(typeof COLOURS[theme][value.alias], name).toBe("string");
        }
        expect(resolveColour(theme, name), name).toMatch(HEX);
      }
    }
  );

  it("resolve aliases per theme", () => {
    expect(resolveColour("light", "input-bg")).toBe(
      resolveColour("light", "surface-raised")
    );
    expect(resolveColour("dark", "input-bg")).toBe(
      resolveColour("dark", "surface-sunken")
    );
  });
});

// tokens.css is hand-written; this keeps it in step with tokens.ts, which the
// contrast check reads.
describe("tokens.css", () => {
  it.each([
    ["light", ':root,\n[data-theme="light"]'],
    ["dark", ':root[data-theme="dark"],\n[data-theme="dark"]'],
    ["dark", ':root:not([data-theme="light"])'],
  ] as const)(
    "declares every %s token as tokens.ts has it (%s)",
    (theme, selector) => {
      const declarations = block(selector);
      for (const name of names) {
        const value = COLOURS[theme][name];
        const expected =
          typeof value === "string"
            ? `--bt-${name}: ${channelString(value)};`
            : `--bt-${name}: var(--bt-${value.alias});`;
        expect(declarations, name).toContain(expected);
      }
    }
  );

  it("has the theme-colour constants equal the canvas token", () => {
    expect(THEME_COLOURS).toEqual({
      light: resolveColour("light", "canvas"),
      dark: resolveColour("dark", "canvas"),
    });
  });
});
