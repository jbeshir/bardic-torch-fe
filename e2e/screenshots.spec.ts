import { waitForHydration } from "./support/hydration";
import { test } from "./support/test";

/**
 * On demand (`npm run screenshots`), never part of `npm run test:e2e`: each
 * page template, light and dark, at 360 and 1280, full page, into
 * e2e/screenshots/ (gitignored).
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
  for (const colorScheme of ["light", "dark"] as const) {
    for (const width of [360, 1280]) {
      test(`${path} ${colorScheme} ${width}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme });
        await page.setViewportSize({ width, height: 800 });
        await page.goto(path);
        await waitForHydration(page);
        const name = path.replace(/\W+/g, "-").replace(/^-|-$/g, "") || "home";
        await page.screenshot({
          path: `e2e/screenshots/${name}-${colorScheme}-${width}.png`,
          fullPage: true,
        });
      });
    }
  }
}
