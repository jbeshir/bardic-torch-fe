/**
 * The colour tokens (docs/DESIGN.md §2): the one TypeScript place that holds
 * colour values. app/styles/tokens.css, the theme-colour constants and
 * public/favicon.svg are written by hand to match; tokens.test.ts checks
 * tokens.css and theme-colour.ts.
 */

export type Theme = "light" | "dark";
type Hex = `#${string}`;

/** The red, green and blue channels of a colour, 0–255. */
function channels(hex: Hex): readonly [number, number, number] {
  const channel = (start: number) =>
    Number.parseInt(hex.slice(start, start + 2), 16);
  return [channel(1), channel(3), channel(5)];
}

/** `"247 242 232"`: the form the CSS custom properties hold. */
export function channelString(hex: Hex): string {
  return channels(hex).join(" ");
}

/** `colour` laid over `base` at `alpha`, as one opaque colour. */
function composite(colour: Hex, base: Hex, alpha: number): Hex {
  const top = channels(colour);
  const bottom = channels(base);
  const mixed = top.map((value, index) =>
    Math.round(value * alpha + (bottom[index] ?? value) * (1 - alpha))
      .toString(16)
      .padStart(2, "0")
  );
  return `#${mixed.join("").toUpperCase()}`;
}

/** Alpha of `accent-glow` at the strongest point of the home hero glow. */
const HERO_GLOW_ALPHA: Readonly<Record<Theme, number>> = {
  light: 0.18,
  dark: 0.08,
};

const lightSurface: Hex = "#FFFCF6";
const lightAccentGlow: Hex = "#E8A33D";
const darkSurface: Hex = "#1D1814";
const darkAccentGlow: Hex = "#E9A440";

const light = {
  canvas: "#F7F2E8",
  surface: lightSurface,
  "surface-raised": "#FFFFFF",
  "surface-sunken": "#EFE7D8",
  border: "#E0D5C2",
  "border-strong": "#8A7A64",
  fg: "#2B2118",
  "fg-muted": "#55483A",
  "fg-subtle": "#6E6152",
  link: "#1F4F8F",
  "link-visited": "#6A3B80",
  "link-hover": "#153A6D",
  accent: "#A8470C",
  "accent-hover": "#8C3B0A",
  "accent-fg": "#FFFCF6",
  "accent-text": "#9A410B",
  "accent-subtle": "#FBEBD6",
  "accent-glow": lightAccentGlow,
  "hero-glow": composite(lightAccentGlow, lightSurface, HERO_GLOW_ALPHA.light),
  focus: "#1F5FC4",
  selection: "#F5D9A6",
  scrim: "#2B2118",
  "logo-core": "#E8A33D",
  danger: "#A3123A",
  "danger-hover": "#850E2F",
  "danger-on": "#FFFFFF",
  "info-bg": "#E9F0FA",
  "info-border": "#A9C0E2",
  "info-fg": "#1D3D6B",
  "info-icon": "#2A5A9C",
  "success-bg": "#E8F2E5",
  "success-border": "#9CC596",
  "success-fg": "#1E4A1F",
  "success-icon": "#2F6E2E",
  "warning-bg": "#FBF0D8",
  "warning-border": "#DDBA70",
  "warning-fg": "#5A3C06",
  "warning-icon": "#8A5800",
  "danger-bg": "#FBE8EC",
  "danger-border": "#E3A3B2",
  "danger-fg": "#7A1230",
  "danger-icon": "#B0204A",
  "pending-bg": "#F2ECF8",
  "pending-border": "#BFA9D8",
  "pending-fg": "#4A2E6B",
  "pending-icon": "#6B4C96",
  "cons-low-bg": "#E3F0E0",
  "cons-low-fg": "#1F4D21",
  "cons-low-border": "#3E7D3C",
  "cons-end-bg": "#FCEBD2",
  "cons-end-fg": "#6B3A00",
  "cons-end-border": "#B06A12",
  "cons-crit-bg": "#FBE3DF",
  "cons-crit-fg": "#7E1A12",
  "cons-crit-border": "#B8321F",
  "cons-res-bg": "#E9E6EF",
  "cons-res-fg": "#3A3450",
  "cons-res-border": "#6A6385",
  "cons-un-bg": "#F1ECE3",
  "cons-un-fg": "#55483A",
  "cons-un-border": "#8A7A64",
} as const satisfies Record<string, Hex>;

/** A token with its own value in each theme. */
type PlainName = keyof typeof light;

const dark: Readonly<Record<PlainName, Hex>> = {
  canvas: "#16120E",
  surface: darkSurface,
  "surface-raised": "#27211B",
  "surface-sunken": "#110E0B",
  border: "#3A3129",
  "border-strong": "#7D6E5C",
  fg: "#E4D9C6",
  "fg-muted": "#C7BAA7",
  "fg-subtle": "#A69885",
  link: "#93B8EE",
  "link-visited": "#C9A6E0",
  "link-hover": "#BBD3F6",
  accent: "#E9A440",
  "accent-hover": "#F4BA62",
  "accent-fg": "#1F1407",
  "accent-text": "#EDB25A",
  "accent-subtle": "#33240F",
  "accent-glow": darkAccentGlow,
  "hero-glow": composite(darkAccentGlow, darkSurface, HERO_GLOW_ALPHA.dark),
  focus: "#8DB6FF",
  selection: "#5C4322",
  scrim: "#000000",
  "logo-core": "#F4BA62",
  danger: "#F28BA0",
  "danger-hover": "#F7A9B9",
  "danger-on": "#2A0A12",
  "info-bg": "#172230",
  "info-border": "#36527A",
  "info-fg": "#C2D7F3",
  "info-icon": "#8DB4EA",
  "success-bg": "#16241A",
  "success-border": "#37603E",
  "success-fg": "#C1E2BD",
  "success-icon": "#88C383",
  "warning-bg": "#2A2112",
  "warning-border": "#6E5524",
  "warning-fg": "#F3DAA4",
  "warning-icon": "#E5B24E",
  "danger-bg": "#2E161B",
  "danger-border": "#7E3A4A",
  "danger-fg": "#F6C6D1",
  "danger-icon": "#F28BA0",
  "pending-bg": "#241C2D",
  "pending-border": "#5D4A7B",
  "pending-fg": "#DECDF2",
  "pending-icon": "#B99EE2",
  "cons-low-bg": "#1A2A1C",
  "cons-low-fg": "#BFE3BA",
  "cons-low-border": "#6FAE69",
  "cons-end-bg": "#2E2210",
  "cons-end-fg": "#F5D29A",
  "cons-end-border": "#D49A3C",
  "cons-crit-bg": "#331815",
  "cons-crit-fg": "#F8C3BA",
  "cons-crit-border": "#E57A6B",
  "cons-res-bg": "#24222E",
  "cons-res-fg": "#D6D1E6",
  "cons-res-border": "#8F88AD",
  "cons-un-bg": "#221D18",
  "cons-un-fg": "#C7BAA7",
  "cons-un-border": "#7D6E5C",
};

/** A colour token whose value is another token, resolved per theme in CSS. */
type Alias = { readonly alias: PlainName };

/** Every colour token, per theme (DESIGN §2.3–2.5). */
export const COLOURS = {
  light: {
    ...light,
    "input-bg": { alias: "surface-raised" },
    // Read-only and disabled fields: a step away from `input-bg` in each
    // theme (down into the well in light, up out of it in dark).
    "input-bg-locked": { alias: "surface-sunken" },
  },
  dark: {
    ...dark,
    "input-bg": { alias: "surface-sunken" },
    "input-bg-locked": { alias: "surface" },
  },
} as const satisfies Record<Theme, Readonly<Record<string, Hex | Alias>>>;

export type ColourName = keyof typeof COLOURS.light;

/** Resolves aliases, giving the colour a token renders as in `theme`. */
export function resolveColour(theme: Theme, name: ColourName): Hex {
  const value = COLOURS[theme][name];
  return typeof value === "string" ? value : resolveColour(theme, value.alias);
}
