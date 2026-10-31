import { expect, test } from "@playwright/test";
import { existsSync, readdirSync } from "node:fs";
import {
  CHECKPOINTS,
  SCREENSHOT_DIR,
  screenshotName,
  THEMES,
  VIEWPORTS,
  type Phase,
} from "./support/checkpoints";

/**
 * Runs as each phase's teardown project, after all of its journeys: every
 * declared checkpoint of the phase must have left its 6 screenshots, and
 * e2e/screenshots must hold nothing no checkpoint declares. Filtered runs
 * (E2E_PARTIAL=1, set by scripts/e2e.mjs) skip the check.
 */

function expectedFiles(phase: Phase): string[] {
  return Object.entries(CHECKPOINTS[phase]).flatMap(([journey, names]) =>
    names.flatMap(name =>
      THEMES.flatMap(theme =>
        VIEWPORTS.map(viewport =>
          screenshotName(journey, name, theme, viewport)
        )
      )
    )
  );
}

test("every declared checkpoint left its screenshots", () => {
  test.skip(process.env.E2E_PARTIAL === "1", "filtered run");
  const phase = test.info().config.metadata.phase as Phase;
  const declared = new Set([
    ...expectedFiles("prod"),
    ...expectedFiles("stub"),
  ]);
  const files = existsSync(SCREENSHOT_DIR) ? readdirSync(SCREENSHOT_DIR) : [];

  expect(
    expectedFiles(phase).filter(file => !files.includes(file)),
    "missing screenshots"
  ).toEqual([]);
  expect(
    files.filter(file => !declared.has(file)),
    "screenshots not declared in e2e/support/checkpoints.ts"
  ).toEqual([]);
});
