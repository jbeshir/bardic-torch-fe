import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  channelString,
  COLOURS,
  resolveColour,
  type ColourName,
} from "./tokens";

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

it("defines the same tokens in both themes, each a #RRGGBB value or an alias", () => {
  expect(Object.keys(COLOURS.dark).sort()).toEqual([...names].sort());
  for (const theme of ["light", "dark"] as const) {
    for (const name of names) {
      expect(resolveColour(theme, name), name).toMatch(/^#[0-9A-F]{6}$/);
    }
  }
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
});
