import { AxeBuilder } from "@axe-core/playwright";
import { expect } from "@playwright/test";
import { waitForHydration } from "./support/hydration";
import { test } from "./support/test";

/**
 * One visit per page template (the same list as screenshots.spec.ts): axe at
 * 1280 in the default light theme, and at 360 no sideways scrolling. Settings
 * is visited signed in (stub sign-in, back to /settings).
 */
const TEMPLATES = [
  "/",
  "/pieces",
  "/search?q=northmarch",
  "/pieces/the-copper-kettle",
  "/pieces/the-copper-kettle/history",
  "/revisions/1003",
  "/bards?letter=W",
  "/bards/wren-of-the-vale",
  "/categories",
  "/categories/swords",
  "/collections",
  "/collections/12",
  "/events",
  "/events/midwinter-revel",
  "/help",
  "/help/conservation-status",
  "/wiki/Northmarch_Rising",
  "/auth/login?as=contributor&returnTo=/settings",
];

for (const path of TEMPLATES) {
  test(`${path}: no axe violations at 1280, no sideways scroll at 360`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(path);
    await waitForHydration(page);
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(violations).toEqual([]);

    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(path);
    await waitForHydration(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
