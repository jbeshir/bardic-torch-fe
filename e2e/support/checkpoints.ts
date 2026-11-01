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

export const CHECKPOINTS: Readonly<
  Record<Phase, Readonly<Record<string, readonly string[]>>>
> = {
  prod: {
    landing: ["home"],
    help: [
      "index",
      "contributing",
      "faq-for-bards",
      "bard-preference-checklist",
      "conservation-status",
      "licence",
    ],
    theme: ["dark-choice"],
    errors: ["not-found"],
  },
  stub: {
    styleguide: [...STYLEGUIDE_BLOCKS, "dialog-open", "drawer-open"],
    navigation: ["account-open"],
    errors: ["profile-unavailable"],
  },
};

export const THEMES: readonly Theme[] = ["light", "dark"];

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
