import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * DESIGN §8.3: reduced motion is handled by one mechanism, the `motion-safe:`
 * variant. Every class that moves something carries it, and hand-written CSS
 * keeps animations, transform transitions and smooth scrolling inside
 * `@media (prefers-reduced-motion: no-preference)`. ESLint has no such rule,
 * so this scan is the check.
 */

const root = process.cwd();

/** Classes that animate movement (or may: `transition` includes transform). */
const MOVING_UTILITY =
  /^(?:transition|transition-all|transition-transform|animate-[a-z-]+)$/;
/** Opacity-only animations, allowed (and meant) for reduced motion. */
const REDUCED_MOTION_ANIMATIONS = new Set(["animate-pulse-soft"]);

/** Moving classes in `source` that aren't guarded by `motion-safe:`. */
function unguardedClasses(source: string): string[] {
  return source.split(/[\s"'`{}()[\],;]+/).filter(token => {
    const parts = token.split(":");
    const utility = parts.pop() ?? "";
    if (!MOVING_UTILITY.test(utility) || utility === "animate-none") {
      return false;
    }
    if (parts.includes("motion-safe")) return false;
    return !(
      parts.includes("motion-reduce") && REDUCED_MOTION_ANIMATIONS.has(utility)
    );
  });
}

const MOVING_DECLARATION =
  /(?<![\w-])(?:animation(?:-name)?\s*:(?!\s*none\b)[^;}]+|transition(?:-property)?\s*:[^;}]*\b(?:transform|translate|scale|rotate|all)\b[^;}]*|scroll-behavior\s*:\s*smooth)/g;
const NO_PREFERENCE = /prefers-reduced-motion\s*:\s*no-preference/;

/** Moving CSS declarations outside a no-preference media block. */
function unguardedDeclarations(css: string): string[] {
  const findings: string[] = [];
  const guards: boolean[] = [];
  let guarded = 0;
  let start = 0;
  for (const match of css.matchAll(/[{}]/g)) {
    const index = match.index ?? 0;
    const segment = css.slice(start, index);
    if (match[0] === "{") {
      // The text since the last brace ends with this block's prelude.
      const prelude = segment.slice(segment.lastIndexOf(";") + 1);
      const isGuard = NO_PREFERENCE.test(prelude);
      guards.push(isGuard);
      if (isGuard) guarded += 1;
      if (guarded === 0) findings.push(...movingIn(segment));
    } else {
      if (guarded === 0) findings.push(...movingIn(segment));
      if (guards.pop()) guarded -= 1;
    }
    start = index + 1;
  }
  return findings;
}

function movingIn(segment: string): string[] {
  return [...segment.matchAll(MOVING_DECLARATION)].map(([match]) =>
    match.trim()
  );
}

function filesUnder(directory: string): string[] {
  return readdirSync(join(root, directory)).flatMap(name => {
    const path = join(directory, name);
    return statSync(join(root, path)).isDirectory() ? filesUnder(path) : [path];
  });
}

const appFiles = filesUnder("app").filter(path => !/\.test\.tsx?$/.test(path));

describe("reduced-motion scan", () => {
  it.each([
    ["transition-transform", ["transition-transform"]],
    ["hover:transition", ["hover:transition"]],
    ["animate-spin", ["animate-spin"]],
    ["motion-safe:transition-transform duration-fast", []],
    ["motion-safe:group-hover:animate-flicker", []],
    ["motion-reduce:animate-pulse-soft motion-safe:animate-spin", []],
    ["motion-reduce:animate-spin", ["motion-reduce:animate-spin"]],
    ["transition-colors duration-instant transition-opacity", []],
    ["animate-none -translate-y-1/2", []],
  ])("in classes %j finds %j", (source, expected) => {
    expect(unguardedClasses(`className="${source}"`)).toEqual(expected);
  });

  it.each([
    [".a { animation: spin 1s linear; }", ["animation: spin 1s linear"]],
    [".a { transition: transform 120ms; }", ["transition: transform 120ms"]],
    ["html { scroll-behavior: smooth; }", ["scroll-behavior: smooth"]],
    [".a { transition: color 80ms; animation: none; }", []],
    [".a { transform: rotate(45deg); }", []],
    [
      "@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } .a { animation: spin 1s; } }",
      [],
    ],
    [
      "@layer base { @media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } } .b { transition: all 1s; } }",
      ["transition: all 1s"],
    ],
  ])("in CSS %j finds %j", (source, expected) => {
    expect(unguardedDeclarations(source)).toEqual(expected);
  });
});

describe("reduced motion in the app", () => {
  it("guards every moving class in app source with motion-safe:", () => {
    const offenders = appFiles
      .filter(path => [".ts", ".tsx", ".md"].includes(extname(path)))
      .flatMap(path =>
        unguardedClasses(readFileSync(join(root, path), "utf8")).map(
          token => `${path}: ${token}`
        )
      );
    expect(offenders).toEqual([]);
  });

  it("keeps moving CSS inside prefers-reduced-motion: no-preference", () => {
    const stylesheets = appFiles.filter(path => extname(path) === ".css");
    expect(stylesheets).toContain("app/styles/base.css");
    const offenders = stylesheets.flatMap(path =>
      unguardedDeclarations(readFileSync(join(root, path), "utf8")).map(
        declaration => `${path}: ${declaration}`
      )
    );
    expect(offenders).toEqual([]);
  });

  it("only scrolls smoothly when motion is welcome", () => {
    const base = readFileSync(join(root, "app/styles/base.css"), "utf8");
    expect(base).toMatch(
      /prefers-reduced-motion: no-preference\)\s*\{\s*html\s*\{\s*scroll-behavior: smooth;/
    );
  });
});
