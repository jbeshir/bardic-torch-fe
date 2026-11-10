import { expect, type Locator, type Page } from "@playwright/test";
import { waitForHydration } from "../support/hydration";
import { checkpoint } from "../support/journey";
import { test } from "../support/test";

/**
 * Forced colours (Windows High Contrast) replace every colour, transparent
 * included, with the system palette. The places that hide the browser's
 * focus outline (`focus-visible:outline-hidden`) rely on that: the main
 * content (focused after a client navigation) and a card's link (whose ring
 * is drawn on its ::after). Each is focused from the keyboard here, its
 * outline must still be drawn, and a checkpoint records how it looks.
 */

test.use({ viewport: { width: 1280, height: 800 } });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
});

/** The computed outline of `locator` (or of its ::after) is drawn. */
async function expectOutlineDrawn(locator: Locator, pseudo?: "::after") {
  const outline = await locator.evaluate((element, pseudoElement) => {
    const style = getComputedStyle(element, pseudoElement);
    return { style: style.outlineStyle, width: style.outlineWidth };
  }, pseudo ?? null);
  expect(outline.style, `outline-style${pseudo ?? ""}`).not.toBe("none");
  expect(
    Number.parseFloat(outline.width),
    `outline-width${pseudo ?? ""}`
  ).toBeGreaterThan(0);
}

async function expectForcedColours(page: Page) {
  expect(
    await page.evaluate(() => matchMedia("(forced-colors: active)").matches)
  ).toBe(true);
}

/** Moves focus onto `locator` with the keyboard, as Tab would. */
async function focusByKeyboard(page: Page, locator: Locator) {
  await locator.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(locator).toBeFocused();
}

const helpCard = (page: Page) =>
  page.getByRole("main").getByRole("link", { name: "Contributing guide" });

test("a card link keeps its focus ring in forced colours", async ({ page }) => {
  await page.goto("/help");
  await waitForHydration(page);
  await expectForcedColours(page);
  const link = helpCard(page);
  await focusByKeyboard(page, link);
  await expectOutlineDrawn(link);
  await expectOutlineDrawn(link, "::after");
  await checkpoint(page, "card-link-focus");
});

test("the main content keeps its focus outline after a keyboard navigation", async ({
  page,
}) => {
  await page.goto("/help");
  await waitForHydration(page);
  await expectForcedColours(page);
  await focusByKeyboard(page, helpCard(page));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/help\/contributing$/);
  const main = page.getByRole("main");
  await expect(main).toBeFocused();
  await expectOutlineDrawn(main);
  await checkpoint(page, "main-focus");
});
