// The Tailwind theme, written into app/styles/tokens.css by
// scripts/build-tokens.mjs (DESIGN Appendix A). `--*: initial` clears every
// Tailwind default, so only what is written here exists.
//
// - Token values (colours, type, shadows, motion, radii, fonts) come from
//   app/styles/tokens.ts and read the per-theme `--bt-*` variables.
// - Every other namespace Tailwind 4 has gets a fixed scale: `FIXED_SCALES`
//   below. The namespace list is read from tailwindcss/theme.css, so a
//   namespace a new Tailwind adds can't go unnoticed.
// - Keys Tailwind 4 has no namespace for are named utilities (`UTILITIES`).
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  COLOURS,
  DURATIONS,
  EASINGS,
  FONT_FAMILIES,
  RADII,
  TYPE_SCALE,
} from "../app/styles/tokens.ts";

/** The runtime variable a token is read from: `--bt-canvas`, … */
export const runtimeVariable = name => `--bt-${name}`;
const bt = name => `var(${runtimeVariable(name)})`;
/** A colour token as a colour, at an alpha if one is given. */
const tokenColour = (name, alpha) =>
  alpha === undefined
    ? `rgb(var(${runtimeVariable(name)}))`
    : `rgb(var(${runtimeVariable(name)}) / ${alpha})`;

/**
 * The project's fixed scales for the namespaces the tokens don't set. The
 * values are Tailwind 3.4.17's defaults, and spacing adds `13`. Spacing
 * is written as named keys only (no bare `--spacing`), so a value off the
 * scale (`p-17`) is not a class.
 */
const FIXED_SCALES = {
  spacing: {
    0: "0px",
    px: "1px",
    0.5: "0.125rem",
    1: "0.25rem",
    1.5: "0.375rem",
    2: "0.5rem",
    2.5: "0.625rem",
    3: "0.75rem",
    3.5: "0.875rem",
    4: "1rem",
    5: "1.25rem",
    6: "1.5rem",
    7: "1.75rem",
    8: "2rem",
    9: "2.25rem",
    10: "2.5rem",
    11: "2.75rem",
    12: "3rem",
    13: "3.25rem",
    14: "3.5rem",
    16: "4rem",
    20: "5rem",
    24: "6rem",
    28: "7rem",
    32: "8rem",
    36: "9rem",
    40: "10rem",
    44: "11rem",
    48: "12rem",
    52: "13rem",
    56: "14rem",
    60: "15rem",
    64: "16rem",
    72: "18rem",
    80: "20rem",
    96: "24rem",
  },
  breakpoint: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px",
  },
  "font-weight": {
    thin: "100",
    extralight: "200",
    light: "300",
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    extrabold: "800",
    black: "900",
  },
  leading: {
    3: ".75rem",
    4: "1rem",
    5: "1.25rem",
    6: "1.5rem",
    7: "1.75rem",
    8: "2rem",
    9: "2.25rem",
    10: "2.5rem",
    none: "1",
    tight: "1.25",
    snug: "1.375",
    normal: "1.5",
    relaxed: "1.625",
    loose: "2",
  },
  tracking: {
    tighter: "-0.05em",
    tight: "-0.025em",
    normal: "0em",
    wide: "0.025em",
    wider: "0.05em",
    widest: "0.1em",
  },
  // The named max-width sizes; the project's own widths are under
  // `max-width`.
  container: {
    xs: "20rem",
    sm: "24rem",
    md: "28rem",
    lg: "32rem",
    xl: "36rem",
    "2xl": "42rem",
    "3xl": "48rem",
    "4xl": "56rem",
    "5xl": "64rem",
    "6xl": "72rem",
    "7xl": "80rem",
  },
  "max-width": {
    prose: "68ch",
    form: "42rem",
    shell: "90rem",
    "screen-sm": "640px",
    "screen-md": "768px",
    "screen-lg": "1024px",
    "screen-xl": "1280px",
    "screen-2xl": "1536px",
  },
  blur: {
    DEFAULT: "8px",
    0: "0",
    sm: "4px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    "2xl": "40px",
    "3xl": "64px",
  },
  aspect: { auto: "auto", square: "1 / 1", video: "16 / 9" },
};

/** The animations (DESIGN §8.2), each with its keyframes. */
const ANIMATIONS = {
  none: { animation: "none" },
  spin: {
    animation: "spin 800ms linear infinite",
    keyframes: { to: { transform: "rotate(360deg)" } },
  },
  "pulse-soft": {
    animation: `pulse-soft 1.2s ${bt("ease-standard")} infinite`,
    keyframes: { "50%": { opacity: "0.4" } },
  },
  shimmer: {
    animation: "shimmer 1.6s linear infinite",
    keyframes: {
      from: { transform: "translateX(-100%)" },
      to: { transform: "translateX(100%)" },
    },
  },
  progress: {
    animation: `progress 2s ${bt("ease-out")} infinite`,
    keyframes: {
      from: { transform: "translateX(-100%)" },
      to: { transform: "translateX(0)" },
    },
  },
  flicker: {
    animation: `flicker ${bt("dur-flicker")} ${bt("ease-standard")} 1`,
    keyframes: {
      "0%, 100%": { transform: "scaleY(1)" },
      "40%": { transform: "scaleY(1.04)" },
      "70%": { transform: "scaleY(0.98)" },
    },
  },
  "fade-in": {
    animation: `fade-in ${bt("dur-fast")} ${bt("ease-out")}`,
    keyframes: { from: { opacity: "0" } },
  },
  "dialog-in": {
    animation: `dialog-in ${bt("dur-base")} ${bt("ease-out")}`,
    keyframes: { from: { opacity: "0", transform: "scale(0.98)" } },
  },
  "toast-in": {
    animation: `toast-in ${bt("dur-base")} ${bt("ease-out")}`,
    keyframes: { from: { opacity: "0", transform: "translateY(8px)" } },
  },
  "sheet-in": {
    animation: `sheet-in ${bt("dur-slow")} ${bt("ease-out")}`,
    keyframes: { from: { transform: "translateY(100%)" } },
  },
  "drawer-in": {
    animation: `drawer-in ${bt("dur-slow")} ${bt("ease-out")}`,
    keyframes: { from: { transform: "translateX(-100%)" } },
  },
};

const SAFE_AREA_BOTTOM = "env(safe-area-inset-bottom, 0px)";

/**
 * Named utilities for the values Tailwind 4 has no theme namespace for, and
 * the few classes whose Tailwind 4 form would paint differently from what
 * the design specifies: each declaration is written out here.
 */
const UTILITIES = {
  // The home-indicator inset on notched phones, under bottom sheets.
  "pb-safe-b": { "padding-bottom": SAFE_AREA_BOTTOM },
  // Room under the page for the fixed bottom app bar (below md).
  "pb-app-bar": {
    "padding-bottom": `calc(${bt("app-bar-h")} + ${SAFE_AREA_BOTTOM})`,
  },
  "max-h-sheet": { "max-height": "85dvh" },
  "max-h-below-header": { "max-height": `calc(100dvh - ${bt("header-h")})` },
  "min-h-textarea": { "min-height": "7.5rem" },
  "top-toast": { top: `calc(${bt("header-h")} + 0.5rem)` },
  "top-header": { top: bt("header-h") },
  "bottom-above-app-bar": {
    bottom: `calc(${bt("app-bar-h")} + ${SAFE_AREA_BOTTOM} + 1rem)`,
  },
  "h-header": { height: bt("header-h") },
  "h-app-bar": { height: bt("app-bar-h") },
  "h-text-line": { height: "0.75em" },
  "h-progress": { height: "3px" },
  "w-dialog": { width: "min(32rem, calc(100vw - 2rem))" },
  "w-drawer": { width: "min(20rem, 85vw)" },
  "w-infobox": { width: "16.5rem" },
  "w-infobox-xl": { width: "18rem" },
  "grid-cols-infobox": { "grid-template-columns": "7rem 1fr" },
  // The persistent sidebar and the main column, lg and xl.
  "grid-cols-shell": { "grid-template-columns": "15rem minmax(0, 1fr)" },
  "grid-cols-shell-xl": { "grid-template-columns": "16rem minmax(0, 1fr)" },
  // The main sheet's row takes the spare height, so the footer row sits at
  // the bottom of a short page.
  "grid-rows-shell": { "grid-template-rows": "1fr auto" },
  // The logo flicker scales the flame from near its base.
  "origin-flame": { "transform-origin": "50% 90%" },
  "underline-offset-prose": { "text-underline-offset": "0.2em" },
  // Tailwind 4's list adds outline-color, which would fade a focus ring in
  // instead of drawing it at once; this list leaves it out. The declaration
  // follows Tailwind's own in the same rule, so it wins.
  "transition-colors": {
    "transition-property":
      "color, background-color, border-color, text-decoration-color, fill, stroke",
  },
  "z-header": { "z-index": "30" },
  "z-progress": { "z-index": "40" },
  "z-toast": { "z-index": "50" },
  // The home hero's glow (DESIGN §10.1): strongest at the top left, on
  // `surface` only, so its text pairs are checked against `hero-glow`.
  "bg-hero": {
    "background-image": `radial-gradient(ellipse at top left, ${tokenColour("hero-glow")}, ${tokenColour("hero-glow", "0")} 70%)`,
  },
  // The skeleton's sweep: surface-raised at the shimmer alpha, in the
  // middle of a transparent band. Tailwind 4's gradient utilities would
  // interpolate in oklab, which paints other colours than this sRGB one.
  "bg-shimmer": {
    "background-image": `linear-gradient(to right, transparent, ${tokenColour("surface-raised", bt("shimmer-alpha"))}, transparent)`,
  },
  // The sidebar's "more below" fade: canvas, clearing upwards.
  "bg-fade-up": {
    "background-image": `linear-gradient(to top, ${tokenColour("canvas", "1")}, ${tokenColour("canvas", "0")})`,
  },
};

/**
 * A space between stacked children: a top margin on every child after the
 * first that has no `hidden` attribute. Tailwind 4's `space-y-*` puts the margin on the other side and drops
 * the specificity, and `gap` drops the space before a child hidden by a
 * class (the drawer footer's `md:hidden` slot).
 */
const STACK_SPACES = ["1", "3", "4", "6"];

/**
 * Colour utilities at an alpha, written as an sRGB alpha
 * (`rgb(var(--bt-link) / 0.4)`). Tailwind 4's `/40` modifier mixes in oklab
 * (`color-mix()`), which can paint a channel one step off. The class is
 * `<utility>-<colour>-<alpha>`; the alpha is a percentage or a named one.
 */
const ALPHA_UTILITIES = [
  ["bg", "fg", "10"],
  ["bg", "scrim", "scrim"],
  ["decoration", "fg-subtle", "50"],
  ["decoration", "link", "40"],
  ["decoration", "link-visited", "40"],
];
const ALPHA_PROPERTIES = {
  bg: "background-color",
  decoration: "text-decoration-color",
};
const NAMED_ALPHAS = new Set(["shimmer", "scrim"]);

const alpha = value =>
  NAMED_ALPHAS.has(value) ? bt(`${value}-alpha`) : String(Number(value) / 100);

const declarations = (properties, indent) =>
  Object.entries(properties)
    .map(([property, value]) => `${indent}${property}: ${value};`)
    .join("\n");

function utilitiesCss() {
  const named = Object.entries(UTILITIES).map(
    ([name, properties]) =>
      `@utility ${name} {\n${declarations(properties, "  ")}\n}`
  );
  const stacks = STACK_SPACES.map(
    space =>
      `@utility stack-y-${space} {\n  & > :not([hidden]) ~ :not([hidden]) {\n    margin-top: ${FIXED_SCALES.spacing[space]};\n    margin-bottom: 0px;\n  }\n}`
  );
  const alphas = ALPHA_UTILITIES.map(
    ([utility, colour, a]) =>
      `@utility ${utility}-${colour}-${a} {\n  ${ALPHA_PROPERTIES[utility]}: ${tokenColour(colour, alpha(a))};\n}`
  );
  return [...named, ...stacks, ...alphas].join("\n");
}

/**
 * `--<namespace>-<key>: <value>;` per key; `DEFAULT` is the bare name. A
 * dot in a key is written `_` (`--spacing-0_5`), as Tailwind looks it up.
 */
function namespace(name, values) {
  return Object.entries(values).map(([key, value]) =>
    key === "DEFAULT"
      ? `--${name}: ${value};`
      : `--${name}-${key.replaceAll(".", "_")}: ${value};`
  );
}

/** The `@theme` keys per Tailwind 4 namespace (reference-only ones empty). */
function namespaces() {
  const colourNames = [
    "transparent",
    "current",
    "inherit",
    ...Object.keys(COLOURS.light),
  ];
  const colour = name =>
    ({
      transparent: "transparent",
      current: "currentColor",
      inherit: "inherit",
    })[name] ?? tokenColour(name);
  return {
    static: {
      spacing: namespace("spacing", FIXED_SCALES.spacing),
      breakpoint: namespace("breakpoint", FIXED_SCALES.breakpoint),
      "font-weight": namespace("font-weight", FIXED_SCALES["font-weight"]),
      leading: namespace("leading", FIXED_SCALES.leading),
      tracking: namespace("tracking", FIXED_SCALES.tracking),
      container: namespace("container", FIXED_SCALES.container),
      "max-width": namespace("max-width", FIXED_SCALES["max-width"]),
      blur: namespace("blur", FIXED_SCALES.blur),
      aspect: namespace("aspect", FIXED_SCALES.aspect),
      radius: namespace("radius", { DEFAULT: RADII.md, ...RADII }),
      font: namespace(
        "font",
        Object.fromEntries(
          Object.entries(FONT_FAMILIES).map(([name, stack]) => [
            name,
            stack.join(", "),
          ])
        )
      ),
      animate: namespace(
        "animate",
        Object.fromEntries(
          Object.entries(ANIMATIONS).map(([name, { animation }]) => [
            name,
            animation,
          ])
        )
      ),
      // Tailwind's default drop shadows are raw black, which the tokens
      // don't allow (DESIGN §2.1), and the design has none.
      "drop-shadow": [],
      // The design has none of these.
      "inset-shadow": [],
      "text-shadow": [],
      perspective: [],
    },
    // Read the per-theme variables, so they're inlined into each class.
    inline: {
      color: colourNames.map(name => `--color-${name}: ${colour(name)};`),
      text: Object.entries(TYPE_SCALE).flatMap(([name, style]) => [
        `--text-${name}: ${bt(`text-${name}`)};`,
        `--text-${name}--line-height: ${style.lineHeight};`,
        `--text-${name}--letter-spacing: ${style.letterSpacing};`,
        `--text-${name}--font-weight: ${style.weight};`,
      ]),
      shadow: [
        "--shadow-none: none;",
        ...["1", "2", "3"].map(n => `--shadow-${n}: ${bt(`shadow-${n}`)};`),
        // The current nav item's 3 px accent bar on its left edge (DESIGN §5.3).
        `--shadow-current-bar: inset 3px 0 0 ${tokenColour("accent")};`,
      ],
      ease: Object.keys(EASINGS).map(
        name => `--ease-${name}: ${bt(`ease-${name}`)};`
      ),
      // Not in theme.css, but the namespace `duration-*` reads.
      "transition-duration": Object.keys(DURATIONS).map(
        name => `--transition-duration-${name}: ${bt(`dur-${name}`)};`
      ),
    },
  };
}

/** How many keys the theme writes per namespace; 0 for a cleared one. */
function writtenNamespaces() {
  return Object.fromEntries(
    Object.values(namespaces()).flatMap(group =>
      Object.entries(group).map(([name, keys]) => [name, keys.length])
    )
  );
}

/**
 * The namespaces of Tailwind's default theme, from tailwindcss/theme.css:
 * every `--<namespace>-<key>` there, by the longest namespace this module
 * knows. Throws on a variable none of them covers.
 */
async function tailwindNamespaces() {
  const known = Object.keys(writtenNamespaces());
  const source = await readFile(
    fileURLToPath(import.meta.resolve("tailwindcss/theme.css")),
    "utf8"
  );
  const found = new Set();
  for (const [, name] of source.matchAll(/^\s*--([a-z0-9-]+)\s*:/gm)) {
    if (name.startsWith("default-") || name.includes("--")) continue;
    const match = known
      .filter(ns => name === ns || name.startsWith(`${ns}-`))
      .sort((a, b) => b.length - a.length)[0];
    if (match === undefined) {
      throw new Error(
        `tailwindcss/theme.css has --${name}, in a namespace scripts/tailwind-theme.mjs doesn't write`
      );
    }
    found.add(match);
  }
  return [...found].sort();
}

function keyframesCss() {
  return Object.entries(ANIMATIONS)
    .filter(([, { keyframes }]) => keyframes !== undefined)
    .map(
      ([name, { keyframes }]) =>
        `  @keyframes ${name} {\n${Object.entries(keyframes)
          .map(
            ([step, properties]) =>
              `    ${step} {\n${declarations(properties, "      ")}\n    }`
          )
          .join("\n")}\n  }`
    )
    .join("\n");
}

/** The `@theme` blocks and the named utilities, for tokens.css. */
export async function tailwindThemeCss() {
  // Fails on a namespace of Tailwind's theme this module doesn't write.
  await tailwindNamespaces();
  const { static: plain, inline } = namespaces();
  const lines = list => list.map(line => `  ${line}`).join("\n");
  return `@theme {
  --*: initial;
${lines(Object.values(plain).flat())}
  --default-font-family: var(--font-sans);
  --default-mono-font-family: var(--font-mono);
  --default-transition-duration: ${bt("dur-instant")};
  --default-transition-timing-function: ${bt("ease-standard")};
  --default-ring-width: 3px;
${keyframesCss()}
}
@theme inline {
${lines(Object.values(inline).flat())}
}
${utilitiesCss()}
`;
}
