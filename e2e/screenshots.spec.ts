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
  "/auth/login?as=contributor&returnTo=/pieces/the-copper-kettle/edit",
  "/auth/login?as=contributor&returnTo=/pieces/new",
  "/auth/login?as=contributor&returnTo=/bards/wren-of-the-vale/edit",
  "/auth/login?as=contributor&returnTo=/categories/swords/edit",
  "/auth/login?as=contributor&returnTo=/collections/12/edit",
  "/auth/login?as=contributor&returnTo=/events/midwinter-revel/edit",
  "/auth/login?as=contributor&returnTo=/contributions",
  "/needs-work",
  "/contact",
  "/auth/login?as=moderator&returnTo=/moderation",
  "/auth/login?as=moderator&returnTo=/moderation/revisions/1901",
  "/auth/login?as=moderator&returnTo=/moderation/contact",
  "/auth/login?as=moderator&returnTo=/moderation/users",
  "/auth/login?as=moderator&returnTo=/moderation/links?url=https%3A%2F%2Fvideo.example%2Fwatch%2Fkettle-hearth",
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
