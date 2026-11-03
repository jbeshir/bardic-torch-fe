import { expect, test } from "@playwright/test";
import { existsSync, readdirSync } from "node:fs";
import {
  CHECKPOINTS,
  checkpointThemes,
  SCREENSHOT_DIR,
  screenshotName,
  VIEWPORTS,
  type Phase,
} from "./support/checkpoints";

/**
 * Runs as each phase's teardown project, after all of its journeys (with
 * and without JS). The screenshots that belong to the phase must be
 * exactly its declared checkpoints × their themes (both, unless
 * checkpointThemes says otherwise) × 3 viewports, and
 * e2e/screenshots must hold nothing that no checkpoint of either phase
 * declares. `npm run test:e2e` empties the folder first; filtered runs
 * (E2E_PARTIAL=1, set by scripts/e2e.mjs) skip the check.
 */

const PHASES: readonly Phase[] = ["prod", "stub"];

function expectedFiles(phase: Phase): string[] {
  return Object.entries(CHECKPOINTS[phase]).flatMap(([journey, names]) =>
    names.flatMap(name =>
      checkpointThemes(journey, name).flatMap(theme =>
        VIEWPORTS.map(viewport =>
          screenshotName(journey, name, theme, viewport)
        )
      )
    )
  );
}

test("every declared checkpoint left its screenshots, and nothing else is there", () => {
  test.skip(process.env.E2E_PARTIAL === "1", "filtered run");
  const phase = test.info().config.metadata.phase as Phase;
  const byPhase = new Map(PHASES.map(each => [each, expectedFiles(each)]));

  // Screenshot names carry no phase, so the phases' names must not meet.
  const [prod = [], stub = []] = PHASES.map(each => byPhase.get(each) ?? []);
  expect(
    prod.filter(file => stub.includes(file)),
    "checkpoints declared in both phases"
  ).toEqual([]);

  const expected = byPhase.get(phase) ?? [];
  const files = existsSync(SCREENSHOT_DIR) ? readdirSync(SCREENSHOT_DIR) : [];
  const declared = new Set([...prod, ...stub]);
  expect(
    files.filter(file => expected.includes(file)).sort(),
    `${phase} screenshots`
  ).toEqual([...expected].sort());
  expect(
    files.filter(file => !declared.has(file)),
    "screenshots not declared in e2e/support/checkpoints.ts"
  ).toEqual([]);
});
