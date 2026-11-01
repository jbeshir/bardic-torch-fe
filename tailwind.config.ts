import type { Config } from "tailwindcss";
import {
  COLOURS,
  DURATIONS,
  EASINGS,
  FONT_FAMILIES,
  RADII,
  TYPE_SCALE,
  type ColourName,
} from "./app/styles/tokens";

/**
 * Every value comes from app/styles/tokens.ts (DESIGN Appendix A). Keys set
 * directly under `theme` replace Tailwind's defaults, so its palette, size
 * scale, radii, shadows and durations don't exist and can't be used.
 */

const colourNames = Object.keys(COLOURS.light) as ColourName[];

const tokenColours = Object.fromEntries(
  colourNames.map(name => [name, `rgb(var(--${name}) / <alpha-value>)`])
);

type FontSize = [
  size: string,
  style: { lineHeight: string; letterSpacing: string; fontWeight: string },
];

const fontSize = Object.fromEntries(
  Object.entries(TYPE_SCALE).map(([name, style]): [string, FontSize] => [
    name,
    [
      `var(--text-${name})`,
      {
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        fontWeight: style.weight,
      },
    ],
  ])
);

const cssVariables = (prefix: string, names: readonly string[]) =>
  Object.fromEntries(names.map(name => [name, `var(--${prefix}-${name})`]));

export default {
  content: ["./app/**/*.{ts,tsx,md}"],
  future: { hoverOnlyWhenSupported: true },
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      inherit: "inherit",
      ...tokenColours,
    },
    fontFamily: Object.fromEntries(
      Object.entries(FONT_FAMILIES).map(([name, stack]) => [name, [...stack]])
    ),
    fontSize,
    borderRadius: { ...RADII, DEFAULT: RADII.md },
    borderWidth: { DEFAULT: "1px", 0: "0", 2: "2px", 3: "3px" },
    boxShadow: {
      none: "none",
      1: "var(--shadow-1)",
      2: "var(--shadow-2)",
      3: "var(--shadow-3)",
      // The current nav item's 3 px accent bar on its left edge (DESIGN §5.3).
      "current-bar": "inset 3px 0 0 rgb(var(--accent))",
    },
    transitionDuration: {
      DEFAULT: "var(--dur-instant)",
      ...cssVariables("dur", Object.keys(DURATIONS)),
    },
    transitionTimingFunction: {
      DEFAULT: "var(--ease-standard)",
      ...cssVariables("ease", Object.keys(EASINGS)),
    },
    keyframes: {
      spin: { to: { transform: "rotate(360deg)" } },
      "pulse-soft": { "50%": { opacity: "0.4" } },
      shimmer: {
        from: { transform: "translateX(-100%)" },
        to: { transform: "translateX(100%)" },
      },
      progress: {
        from: { transform: "translateX(-100%)" },
        to: { transform: "translateX(0)" },
      },
      flicker: {
        "0%, 100%": { transform: "scaleY(1)" },
        "40%": { transform: "scaleY(1.04)" },
        "70%": { transform: "scaleY(0.98)" },
      },
      "fade-in": { from: { opacity: "0" } },
      "dialog-in": { from: { opacity: "0", transform: "scale(0.98)" } },
      "toast-in": { from: { opacity: "0", transform: "translateY(8px)" } },
      "sheet-in": { from: { transform: "translateY(100%)" } },
      "drawer-in": { from: { transform: "translateX(-100%)" } },
    },
    animation: {
      none: "none",
      spin: "spin 800ms linear infinite",
      "pulse-soft": "pulse-soft 1.2s var(--ease-standard) infinite",
      shimmer: "shimmer 1.6s linear infinite",
      progress: "progress 2s var(--ease-out) infinite",
      flicker: "flicker var(--dur-flicker) var(--ease-standard) 1",
      "fade-in": "fade-in var(--dur-fast) var(--ease-out)",
      "dialog-in": "dialog-in var(--dur-base) var(--ease-out)",
      "toast-in": "toast-in var(--dur-base) var(--ease-out)",
      "sheet-in": "sheet-in var(--dur-slow) var(--ease-out)",
      "drawer-in": "drawer-in var(--dur-slow) var(--ease-out)",
    },
    extend: {
      spacing: { 13: "3.25rem" },
      // The home-indicator inset on notched phones, under bottom sheets.
      padding: {
        "safe-b": "env(safe-area-inset-bottom, 0px)",
        // Room under the page for the fixed bottom app bar (below md).
        "app-bar": "calc(var(--app-bar-h) + env(safe-area-inset-bottom, 0px))",
      },
      maxWidth: { prose: "68ch", form: "42rem", shell: "90rem" },
      maxHeight: {
        sheet: "85dvh",
        "below-header": "calc(100dvh - var(--header-h))",
      },
      inset: {
        toast: "calc(var(--header-h) + 0.5rem)",
        header: "var(--header-h)",
        "above-app-bar":
          "calc(var(--app-bar-h) + env(safe-area-inset-bottom, 0px) + 1rem)",
      },
      gridTemplateColumns: {
        infobox: "7rem 1fr",
        // The persistent sidebar and the main column, lg and xl.
        shell: "15rem minmax(0, 1fr)",
        "shell-xl": "16rem minmax(0, 1fr)",
      },
      // The logo flicker scales the flame from near its base.
      transformOrigin: { flame: "50% 90%" },
      opacity: { shimmer: "var(--shimmer-alpha)", scrim: "var(--scrim-alpha)" },
      height: {
        header: "var(--header-h)",
        "app-bar": "var(--app-bar-h)",
        "text-line": "0.75em",
        progress: "3px",
      },
      minHeight: { textarea: "7.5rem" },
      width: {
        dialog: "min(32rem, calc(100vw - 2rem))",
        drawer: "min(20rem, 85vw)",
        infobox: "16.5rem",
        "infobox-xl": "18rem",
      },
      textUnderlineOffset: { prose: "0.2em" },
      // The home hero's glow (DESIGN §10.1): strongest at the top left, on
      // `surface` only, so its text pairs are checked against `hero-glow`.
      backgroundImage: {
        hero: "radial-gradient(ellipse at top left, rgb(var(--hero-glow)), rgb(var(--hero-glow) / 0) 70%)",
      },
      zIndex: { header: "30", progress: "40", toast: "50" },
    },
  },
  plugins: [],
} satisfies Config;
