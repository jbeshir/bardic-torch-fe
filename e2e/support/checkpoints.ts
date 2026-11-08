import { fileURLToPath } from "node:url";

/**
 * Every visual checkpoint, by phase and journey (the spec file name without
 * `.spec.ts`). `checkpoint()` refuses names missing here, and the global
 * teardown fails unless each one left all of its screenshots.
 */

export type Phase = "prod" | "stub";
export type Theme = "light" | "dark";
type Viewport = { readonly width: number; readonly height: number };

/**
 * The styleguide's blocks, by anchor, in page order (app/styleguide/
 * Gallery.tsx); styleguide.spec.ts checks the page against this list and
 * takes one checkpoint per block.
 */
export const STYLEGUIDE_BLOCKS = [
  "colour",
  "type",
  "spacing",
  "logo",
  "button",
  "link",
  "input",
  "textarea",
  "select",
  "checkbox",
  "error-summary",
  "tabs",
  "infobox",
  "card",
  "tag-list",
  "conservation-badge",
  "alert",
  "empty-state",
  "error-state",
  "loading",
  "breadcrumbs",
  "pagination",
  "drawer",
  "dialog",
  "toast",
  "theme-toggle",
  "account-menu",
  "search-box",
  "table-of-contents",
  "help-links",
  "page-template",
] as const;

/**
 * The styleguide AccountMenu examples whose panel has its own checkpoint,
 * open (by keyboard) one at a time: each state's panel says something
 * different (DESIGN §6.25).
 */
export const ACCOUNT_MENU_OPEN = [
  { checkpoint: "account-menu-open-signed-in", example: "Signed in" },
  {
    checkpoint: "account-menu-open-unavailable",
    example: "Profile couldn’t load",
  },
  { checkpoint: "account-menu-open-blocked", example: "Blocked account" },
] as const;

export const CHECKPOINTS: Readonly<
  Record<Phase, Readonly<Record<string, readonly string[]>>>
> = {
  prod: {
    landing: ["home", "server-html"],
    help: [
      "index",
      "contributing",
      "faq-for-bards",
      "bard-preference-checklist",
      "conservation-status",
      "licence",
    ],
    theme: ["dark-choice"],
    errors: ["not-found", "server-error", "resting"],
    settings: ["signed-out"],
    browse: ["index", "no-results"],
  },
  stub: {
    styleguide: [
      ...STYLEGUIDE_BLOCKS,
      ...ACCOUNT_MENU_OPEN.map(({ checkpoint }) => checkpoint),
      "dialog-open",
      "drawer-open",
    ],
    navigation: ["account-open", "drawer-open"],
    errors: ["profile-unavailable", "settings-error"],
    account: [
      "settings",
      "token-revealed",
      "revoke-confirm",
      "form-errors",
      "at-limit",
      "profile-unavailable",
      "blocked",
    ],
    "forced-colours": ["card-link-focus", "main-focus", "error-heading-focus"],
  },
};

const THEMES: readonly Theme[] = ["light", "dark"];

/**
 * Checkpoints of a state that only exists in some themes, by
 * `journey/name`: a reader who chose Dark is never shown a light page, so
 * `theme/dark-choice` is captured dark only. Every other checkpoint is
 * captured in THEMES.
 */
const ONLY_IN: Readonly<Record<string, readonly Theme[]>> = {
  "theme/dark-choice": ["dark"],
};

/** The themes `journey/name` is captured in. */
export function checkpointThemes(
  journey: string,
  name: string
): readonly Theme[] {
  return ONLY_IN[`${journey}/${name}`] ?? THEMES;
}

export const VIEWPORTS: readonly Viewport[] = [
  { width: 360, height: 800 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];

/** Widths at which every checkpoint also runs axe. */
export const AXE_WIDTHS: readonly number[] = [360, 1280];

export const SCREENSHOT_DIR = fileURLToPath(
  new URL("../screenshots", import.meta.url)
);

export function screenshotName(
  journey: string,
  checkpoint: string,
  theme: Theme,
  { width, height }: Viewport
): string {
  return `${journey}-${checkpoint}-${theme}-${width}x${height}.png`;
}
