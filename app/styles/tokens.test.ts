import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  channelString,
  COLOURS,
  resolveColour,
  THEME_EFFECTS,
  type ColourName,
} from "./tokens";

const HEX = /^#[0-9A-F]{6}$/;
const names = Object.keys(COLOURS.light) as ColourName[];
const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");

/** The declarations of the first block in `source` opened by `selector`. */
function block(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`);
  expect(start, `block ${selector}`).toBeGreaterThanOrEqual(0);
  const open = source.indexOf("{", start);
  // Prettier may wrap long values, so compare with whitespace collapsed.
  return source.slice(open + 1, source.indexOf("}", open)).replace(/\s+/g, " ");
}

const blocks = {
  light: block(css, ':root,\n[data-theme="light"]'),
  dark: block(css, ':root[data-theme="dark"],\n[data-theme="dark"]'),
  "OS dark": block(css, ':root:not([data-theme="light"])'),
} as const;

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
        if (typeof value === "string") {
          expect(value, name).toMatch(HEX);
        } else {
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

  it.each(["light", "dark"] as const)(
    "give %s read-only and disabled fields a fill unlike an editable field's",
    theme => {
      expect(resolveColour(theme, "input-bg-locked")).not.toBe(
        resolveColour(theme, "input-bg")
      );
    }
  );

  it.each(["light", "dark"] as const)(
    "derive the %s hero glow as a faint accent-glow over surface",
    theme => {
      const channels = (name: ColourName) =>
        channelString(resolveColour(theme, name)).split(" ").map(Number);
      const [glow, surface, accentGlow] = [
        channels("hero-glow"),
        channels("surface"),
        channels("accent-glow"),
      ];
      glow.forEach((value, index) => {
        const base = surface[index] ?? Number.NaN;
        const tint = accentGlow[index] ?? Number.NaN;
        // Between the two, and nearer the surface (a low alpha).
        expect(value).toBeGreaterThanOrEqual(Math.min(base, tint));
        expect(value).toBeLessThanOrEqual(Math.max(base, tint));
        expect(Math.abs(value - base)).toBeLessThanOrEqual(
          Math.abs(tint - base) / 4
        );
      });
      expect(glow).not.toEqual(surface);
    }
  );

  it("define the same non-colour effects in both themes", () => {
    expect(Object.keys(THEME_EFFECTS.dark).sort()).toEqual(
      Object.keys(THEME_EFFECTS.light).sort()
    );
  });

  it("write channel triplets", () => {
    expect(channelString(resolveColour("light", "canvas"))).toBe("247 242 232");
  });
});

describe("generated tokens.css", () => {
  it.each([
    ["light", "light"],
    ["dark", "dark"],
    ["OS dark", "dark"],
  ] as const)("declares every token in the %s block", (label, theme) => {
    const declarations = blocks[label];
    expect(declarations).toContain(`color-scheme: ${theme};`);
    for (const name of names) {
      const value = COLOURS[theme][name];
      const expected =
        typeof value === "string"
          ? `--${name}: ${channelString(value)};`
          : `--${name}: var(--${value.alias});`;
      expect(declarations, name).toContain(expected);
    }
    for (const [name, value] of Object.entries(THEME_EFFECTS[theme])) {
      expect(declarations, name).toContain(`--${name}: ${value};`);
    }
  });

  it("puts the OS-dark block behind the media query, skipping explicit light", () => {
    expect(css).toMatch(
      /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{/
    );
  });

  it("lets a [data-theme] wrapper on any element force its theme", () => {
    expect(css).toContain(':root,\n[data-theme="light"] {');
    expect(css).toContain(':root[data-theme="dark"],\n[data-theme="dark"] {');
  });
});
