// What may be a Tailwind class in app/** beyond what the theme defines
// (scripts/tailwind-theme.mjs): the restricted patterns, which
// eslint.config.ts (no-restricted-classes) and test/tailwind-classes.test.ts
// apply, and the component classes the stylesheets define themselves.
import { readdirSync, readFileSync } from "node:fs";

// The fixed scales FE1's Tailwind 3 theme allowed for the utilities that
// Tailwind 4 generates for any number or fraction (`z-37`, `border-5`,
// `w-5/7`). Values from Tailwind 3.4.17's resolved theme for FE1
// (tailwind.config.ts before stage 4).
const STEPS_OF_FIVE = Array.from({ length: 21 }, (_, step) => `${step * 5}`);
const ONE_TO = last =>
  Array.from({ length: last }, (_, index) => `${index + 1}`);
const WIDTHS = ["0", "1", "2", "4", "8"];
const HALVES_TO_SIXTHS = [
  "1/2",
  "1/3",
  "2/3",
  "1/4",
  "2/4",
  "3/4",
  "1/5",
  "2/5",
  "3/5",
  "4/5",
  "1/6",
  "2/6",
  "3/6",
  "4/6",
  "5/6",
];
const TWELFTHS = ONE_TO(11).map(n => `${n}/12`);
const QUARTERS = ["1/2", "1/3", "2/3", "1/4", "2/4", "3/4"];

/**
 * `{ utilities, values, fractions }`: `utilities` is a regex alternation of
 * class names, `values` the numbers or fractions FE1 allowed after them
 * (none: every one is refused, as Tailwind 3 had no such classes). With
 * `fractions`, only fractions are checked: the numbers of a spacing utility
 * are the named spacing keys, and any other is no class at all.
 */
const SCALES = [
  {
    utilities: "border(?:-[xytrblse])?|divide-x|divide-y",
    values: ["0", "2", "3"],
  },
  { utilities: "z", values: ["0", "10", "20", "30", "40", "50"] },
  { utilities: "opacity|backdrop-opacity", values: STEPS_OF_FIVE },
  {
    utilities:
      "ring|ring-offset|outline|outline-offset|decoration|underline-offset",
    values: WIDTHS,
  },
  { utilities: "inset-ring", values: [] },
  { utilities: "stroke", values: ["0", "1", "2"] },
  {
    utilities: "grid-cols|grid-rows|col-span|row-span|order|columns",
    values: ONE_TO(12),
  },
  { utilities: "col-start|col-end|row-start|row-end", values: ONE_TO(13) },
  { utilities: "line-clamp", values: ONE_TO(6) },
  {
    utilities: "scale(?:-[xyz])?",
    values: ["0", "50", "75", "90", "95", "100", "105", "110", "125", "150"],
  },
  {
    utilities: "rotate(?:-[xyz])?",
    values: ["0", "1", "2", "3", "6", "12", "45", "90", "180"],
  },
  { utilities: "skew(?:-[xy])?", values: ["0", "1", "2", "3", "6", "12"] },
  {
    utilities: "delay",
    values: ["0", "75", "100", "150", "200", "300", "500", "700", "1000"],
  },
  // FE1's durations are the named motion tokens only.
  { utilities: "duration", values: [] },
  {
    utilities: "brightness|backdrop-brightness",
    values: [
      "0",
      "50",
      "75",
      "90",
      "95",
      "100",
      "105",
      "110",
      "125",
      "150",
      "200",
    ],
  },
  {
    utilities: "contrast|backdrop-contrast",
    values: ["0", "50", "75", "100", "125", "150", "200"],
  },
  {
    utilities: "saturate|backdrop-saturate",
    values: ["0", "50", "100", "150", "200"],
  },
  {
    utilities: "hue-rotate|backdrop-hue-rotate",
    values: ["0", "15", "30", "60", "90", "180"],
  },
  {
    utilities:
      "grayscale|invert|sepia|backdrop-grayscale|backdrop-invert|backdrop-sepia",
    values: ["0"],
  },
  { utilities: "tab", values: [] },
  {
    utilities: "w|size|basis",
    values: [...HALVES_TO_SIXTHS, ...TWELFTHS],
    fractions: true,
  },
  { utilities: "h", values: HALVES_TO_SIXTHS, fractions: true },
  {
    utilities:
      "inset|inset-x|inset-y|top|right|bottom|left|start|end|translate(?:-[xy])?",
    values: QUARTERS,
    fractions: true,
  },
  {
    utilities: "min-w|max-w|min-h|max-h|aspect",
    values: [],
    fractions: true,
  },
];

const escape = value => value.replaceAll("/", "\\/");

/** A pattern per family that matches its classes with any other value. */
function scalePatterns() {
  return SCALES.map(({ utilities, values, fractions = false }) => {
    const allowed =
      values.length === 0 ? "" : `(?!(?:${values.map(escape).join("|")})$)`;
    const value = fractions ? "\\d+\\/\\d+" : "\\d+(?:\\/\\d+)?";
    return `^(?:[a-z-]+:)*-?(?:${utilities})-${allowed}${value}$`;
  });
}

/**
 * Classes that would step outside the tokens (DESIGN §2.1) or paint unlike
 * FE1, each with the message lint reports.
 */
export const RESTRICTED_CLASSES = [
  {
    pattern: String.raw`\[[^\]]*\]`,
    message: "Arbitrary values: add a named token instead.",
  },
  {
    pattern: "^(?:[a-z-]+:)*dark:",
    message: "Themes come from the tokens, not dark:.",
  },
  {
    pattern: String.raw`\(--`,
    message: "Arbitrary variables: add a named token instead.",
  },
  {
    pattern: String.raw`^\[.*:.*\]$`,
    message: "Arbitrary properties: add a named utility instead.",
  },
  {
    pattern: String.raw`^(?:[a-z-]+:)*-?(?:bg|text|border(?:-[xytrblse])?|ring|ring-offset|outline|fill|stroke|decoration|divide|placeholder|caret|accent|shadow|inset-shadow|inset-ring|drop-shadow|text-shadow)-[a-z][a-z-]*\/`,
    message:
      "An opacity modifier mixes colours in oklab: use the <utility>-<colour>-<alpha> class (scripts/tailwind-theme.mjs).",
  },
  {
    pattern:
      "^(?:[a-z-]+:)*(?:bg-(?:gradient|linear|radial|conic)|from|via|to)-",
    message:
      "Gradient utilities interpolate in oklab: add a named background (scripts/tailwind-theme.mjs).",
  },
  {
    pattern: "^(?:[a-z-]+:)*-?(?:space|divide)-[xy](?:-|$)",
    message: "Tailwind 4 puts this margin on the other side: use stack-y-*.",
  },
  {
    pattern: "^(?:[a-z-]+:)*outline-none$",
    message:
      "outline-none is outline-style: none in Tailwind 4: use outline-hidden.",
  },
  ...scalePatterns().map(pattern => ({
    pattern,
    message:
      "Not on FE1's scale for this utility (scripts/tailwind-classes.mjs).",
  })),
];

const STYLES = new URL("../app/styles/", import.meta.url);

/**
 * Every class named in an `@layer components` block of app/styles/*.css
 * (`prose-bt`, `separated-list`, the `not-prose` marker), which Tailwind
 * doesn't know as utilities.
 */
export function componentClasses() {
  const classes = new Set();
  for (const file of readdirSync(STYLES).filter(name =>
    name.endsWith(".css")
  )) {
    const css = readFileSync(new URL(file, STYLES), "utf8");
    for (const [, block = ""] of css.matchAll(
      /^@layer components \{\n([\s\S]*?)\n\}$/gm
    )) {
      for (const [, name = ""] of block.matchAll(/\.([a-z][\w-]*)/g)) {
        classes.add(name);
      }
    }
  }
  return [...classes].sort();
}
