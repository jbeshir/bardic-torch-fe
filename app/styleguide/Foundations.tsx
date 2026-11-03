import { LogoMark, UnlitMark } from "~/components/LogoMark";
import { Wordmark } from "~/components/Wordmark";
import {
  COLOURS,
  resolveColour,
  TYPE_SCALE,
  type ColourName,
} from "~/styles/tokens";
import { contrastLabel } from "./contrast";
import { Example, Specimen } from "./Specimen";

/**
 * Every colour token's fill, written out so Tailwind sees each class. The
 * Record type makes a new token in tokens.ts a type error here until it
 * has a swatch.
 */
const SWATCHES: Readonly<Record<ColourName, string>> = {
  canvas: "bg-canvas",
  surface: "bg-surface",
  "surface-raised": "bg-surface-raised",
  "surface-sunken": "bg-surface-sunken",
  "input-bg": "bg-input-bg",
  "input-bg-locked": "bg-input-bg-locked",
  border: "bg-border",
  "border-strong": "bg-border-strong",
  fg: "bg-fg",
  "fg-muted": "bg-fg-muted",
  "fg-subtle": "bg-fg-subtle",
  link: "bg-link",
  "link-visited": "bg-link-visited",
  "link-hover": "bg-link-hover",
  accent: "bg-accent",
  "accent-hover": "bg-accent-hover",
  "accent-fg": "bg-accent-fg",
  "accent-text": "bg-accent-text",
  "accent-subtle": "bg-accent-subtle",
  "accent-glow": "bg-accent-glow",
  "hero-glow": "bg-hero-glow",
  focus: "bg-focus",
  selection: "bg-selection",
  scrim: "bg-scrim",
  "logo-core": "bg-logo-core",
  danger: "bg-danger",
  "danger-hover": "bg-danger-hover",
  "danger-on": "bg-danger-on",
  "info-bg": "bg-info-bg",
  "info-border": "bg-info-border",
  "info-fg": "bg-info-fg",
  "info-icon": "bg-info-icon",
  "success-bg": "bg-success-bg",
  "success-border": "bg-success-border",
  "success-fg": "bg-success-fg",
  "success-icon": "bg-success-icon",
  "warning-bg": "bg-warning-bg",
  "warning-border": "bg-warning-border",
  "warning-fg": "bg-warning-fg",
  "warning-icon": "bg-warning-icon",
  "danger-bg": "bg-danger-bg",
  "danger-border": "bg-danger-border",
  "danger-fg": "bg-danger-fg",
  "danger-icon": "bg-danger-icon",
  "pending-bg": "bg-pending-bg",
  "pending-border": "bg-pending-border",
  "pending-fg": "bg-pending-fg",
  "pending-icon": "bg-pending-icon",
  "cons-low-bg": "bg-cons-low-bg",
  "cons-low-fg": "bg-cons-low-fg",
  "cons-low-border": "bg-cons-low-border",
  "cons-end-bg": "bg-cons-end-bg",
  "cons-end-fg": "bg-cons-end-fg",
  "cons-end-border": "bg-cons-end-border",
  "cons-crit-bg": "bg-cons-crit-bg",
  "cons-crit-fg": "bg-cons-crit-fg",
  "cons-crit-border": "bg-cons-crit-border",
  "cons-res-bg": "bg-cons-res-bg",
  "cons-res-fg": "bg-cons-res-fg",
  "cons-res-border": "bg-cons-res-border",
  "cons-un-bg": "bg-cons-un-bg",
  "cons-un-fg": "bg-cons-un-fg",
  "cons-un-border": "bg-cons-un-border",
};

/** The type scale's classes, in the order of TYPE_SCALE. */
const TYPE_CLASSES: Readonly<Record<string, string>> = {
  display: "font-display text-display",
  h1: "font-display text-h1",
  h2: "font-display text-h2",
  h3: "font-display text-h3",
  h4: "font-sans text-h4",
  "body-lg": "font-sans text-body-lg",
  body: "font-sans text-body",
  "body-sm": "font-sans text-body-sm",
  caption: "font-sans text-caption",
  "label-caps": "font-sans text-label-caps uppercase",
  code: "font-mono text-code",
  wordmark: "font-display text-wordmark opsz-32",
};

const SPACING = [
  ["1", "w-1"],
  ["2", "w-2"],
  ["3", "w-3"],
  ["4", "w-4"],
  ["6", "w-6"],
  ["8", "w-8"],
  ["12", "w-12"],
  ["16", "w-16"],
] as const;

const RADII = [
  ["sm", "rounded-sm"],
  ["md", "rounded-md"],
  ["lg", "rounded-lg"],
  ["xl", "rounded-xl"],
  ["full", "rounded-full"],
] as const;

const SHADOWS = [
  ["shadow-1", "shadow-1"],
  ["shadow-2", "shadow-2"],
  ["shadow-3", "shadow-3"],
] as const;

const SURFACES = [
  ["canvas", "bg-canvas"],
  ["surface", "bg-surface"],
  ["surface-raised", "bg-surface-raised"],
  ["surface-sunken", "bg-surface-sunken"],
] as const;

const LOGO_SIZES = [
  ["20", "h-5 w-5"],
  ["24", "h-6 w-6"],
  ["28", "h-7 w-7"],
  ["32", "h-8 w-8"],
] as const;

export function Colours() {
  const names = Object.keys(COLOURS.light) as ColourName[];
  return (
    <Specimen
      id="colour"
      title="Colour"
      summary="Every token, with its value in each theme and its contrast with the canvas (DESIGN §2). The swatch shows the theme being previewed."
    >
      <ul role="list" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {names.map(name => (
          <li
            key={name}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2"
          >
            <span
              aria-hidden="true"
              className={`h-10 w-10 shrink-0 rounded-md border border-border ${SWATCHES[name]}`}
            />
            <span className="min-w-0 text-caption">
              <span className="block font-mono font-medium text-fg">
                {name}
              </span>
              <span className="block whitespace-nowrap text-fg-muted">
                Light {resolveColour("light", name)} ·{" "}
                {contrastLabel("light", name, "canvas")}
              </span>
              <span className="block whitespace-nowrap text-fg-muted">
                Dark {resolveColour("dark", name)} ·{" "}
                {contrastLabel("dark", name, "canvas")}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Specimen>
  );
}

export function TypeScale() {
  return (
    <Specimen
      id="type"
      title="Type scale"
      summary="Fraunces for display and headings, the system sans for text (DESIGN §3)."
    >
      <dl className="grid gap-4">
        {Object.keys(TYPE_SCALE).map(name => (
          <div
            key={name}
            className="grid gap-1 border-b border-border pb-3 sm:grid-cols-infobox sm:gap-4"
          >
            <dt className="whitespace-nowrap font-mono text-caption text-fg-muted">
              text-{name}
            </dt>
            <dd className={`min-w-0 text-fg ${TYPE_CLASSES[name] ?? ""}`}>
              Songs for the hall and the hearth
            </dd>
          </div>
        ))}
      </dl>
    </Specimen>
  );
}

export function SpacingAndShape() {
  return (
    <Specimen
      id="spacing"
      title="Spacing, radii and elevation"
      summary="Tailwind’s 4 px spacing scale, the radius tokens and the three shadows (DESIGN §4). In dark, raised things keep a border."
    >
      <Example label="Spacing" wide>
        <ul role="list" className="grid gap-2">
          {SPACING.map(([step, width]) => (
            <li key={step} className="flex items-center gap-3 text-caption">
              <span className="w-8 font-mono text-fg-muted">{step}</span>
              <span className={`h-3 rounded-sm bg-accent ${width}`} />
            </li>
          ))}
        </ul>
      </Example>
      <Example label="Radii">
        {RADII.map(([name, radius]) => (
          <span
            key={name}
            className={`flex h-16 w-16 items-center justify-center border border-border-strong bg-surface-raised text-caption text-fg ${radius}`}
          >
            {name}
          </span>
        ))}
      </Example>
      <Example label="Elevation">
        {SHADOWS.map(([name, shadow]) => (
          <span
            key={name}
            className={`flex h-20 w-28 items-center justify-center rounded-lg border border-border bg-surface-raised text-caption text-fg ${shadow}`}
          >
            {name}
          </span>
        ))}
      </Example>
    </Specimen>
  );
}

export function Logo() {
  return (
    <Specimen
      id="logo"
      title="Logo"
      summary="The torch mark at 20, 24, 28 and 32 px on every surface, the wordmark, and the unlit torch used by empty and error states (DESIGN §5.9)."
    >
      <Example label="Mark on each surface" wide>
        {SURFACES.map(([name, surface]) => (
          <span
            key={name}
            className={`flex items-end gap-3 rounded-lg border border-border p-3 text-fg ${surface}`}
          >
            {LOGO_SIZES.map(([size, box]) => (
              <LogoMark key={size} className={box} />
            ))}
            <span className="text-caption text-fg-muted">{name}</span>
          </span>
        ))}
      </Example>
      <Example label="Wordmark">
        <Wordmark />
      </Example>
      <Example label="Unlit: empty state, missing page, error page">
        <UnlitMark />
        <UnlitMark size={64} />
        <UnlitMark size={64} dashed />
      </Example>
    </Specimen>
  );
}
