import { fileURLToPath } from "node:url";

/**
 * Every visual checkpoint, by phase and journey (the spec file name without
 * `.spec.ts`). `checkpoint()` refuses names missing here, and the global
 * teardown fails unless each one left all of its screenshots.
 */

export type Phase = "prod" | "stub";
export type Theme = "light" | "dark";
type Viewport = { readonly width: number; readonly height: number };

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
    browse: ["index", "no-results", "filtered", "facet-drawer-open"],
    search: ["results"],
    // Track B (C4, C5): the piece and bard pages.
    piece: ["full", "stub", "restricted"],
    bard: ["profile", "no-page"],
    directories: ["bards"],
    // Track C (C6–C8): categories, collections, events, history.
    categories: ["index", "term"],
    collections: ["directory", "collection"],
    events: ["directory", "event"],
    history: ["piece-history", "revision"],
  },
  stub: {
    navigation: ["account-open", "drawer-open"],
    errors: ["profile-unavailable"],
    account: ["settings", "profile-unavailable", "blocked"],
    "forced-colours": ["card-link-focus", "main-focus"],
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
