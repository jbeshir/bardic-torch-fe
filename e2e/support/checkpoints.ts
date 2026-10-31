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
    landing: ["home"],
    theme: ["dark-choice"],
  },
  stub: {},
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
