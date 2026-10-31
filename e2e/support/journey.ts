import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import {
  AXE_WIDTHS,
  CHECKPOINTS,
  SCREENSHOT_DIR,
  screenshotName,
  THEMES,
  VIEWPORTS,
  type Phase,
  type Theme,
} from "./checkpoints";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * Show the page in `theme`. The one place journeys change theme, so it can
 * move from the OS preference to the site's own setting in one edit.
 */
async function applyTheme(page: Page, theme: Theme): Promise<void> {
  await page.emulateMedia({ colorScheme: theme });
}

async function expectNoAxeViolations(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .analyze();
  const summary = violations.map(
    ({ id, impact, help, nodes }) =>
      `${id} (${impact ?? "unknown"}): ${help}\n` +
      nodes.map(node => `    ${node.target.join(" ")}`).join("\n")
  );
  expect(summary, `axe violations, ${label}`).toEqual([]);
}

/**
 * A visual and accessibility checkpoint of the current page: zero axe
 * violations in light and dark at 360 and 1280 px wide, and a full-page
 * screenshot per theme and viewport in e2e/screenshots. The name must be
 * declared for this journey in support/checkpoints.ts.
 */
export async function checkpoint(page: Page, name: string): Promise<void> {
  const info = test.info();
  const phase = info.project.name as Phase;
  const journey = path.basename(info.file, ".spec.ts");
  if (!CHECKPOINTS[phase]?.[journey]?.includes(name)) {
    throw new Error(
      `Checkpoint "${name}" of journey "${journey}" (${phase}) is not declared in e2e/support/checkpoints.ts`
    );
  }

  const originalViewport = page.viewportSize();
  await test.step(`checkpoint ${journey}/${name}`, async () => {
    for (const theme of THEMES) {
      await applyTheme(page, theme);
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        if (AXE_WIDTHS.includes(viewport.width)) {
          await expectNoAxeViolations(page, `${theme} at ${viewport.width}px`);
        }
        await page.screenshot({
          path: path.join(
            SCREENSHOT_DIR,
            screenshotName(journey, name, theme, viewport)
          ),
          fullPage: true,
          animations: "disabled",
        });
      }
    }
  });
  await page.emulateMedia({ colorScheme: null });
  if (originalViewport) await page.setViewportSize(originalViewport);
}
