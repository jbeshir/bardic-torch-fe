import { expect, type Locator, type Page } from "@playwright/test";
import { createFixtureUser, failNext } from "../support/fixture-api";
import { waitForHydration } from "../support/hydration";
import { checkpoint } from "../support/journey";
import { accountPanel, accountTrigger } from "../support/shell";
import { test } from "../support/test";

/**
 * Forced colours (Windows High Contrast) replace every colour, transparent
 * included, with the system palette. The three places that hide the
 * browser's focus outline (`focus-visible:outline-hidden`) rely on that: the
 * main content (focused after a client navigation), an error page's heading
 * (focused when it renders) and a card's link (whose ring is drawn on its
 * ::after). Each is focused from the keyboard here, its outline must still
 * be drawn, and a checkpoint records how it looks.
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

/**
 * A client-side single fetch of the settings route's loader data alone (the
 * root keeps its data on a plain navigation, so it opts out).
 */
function isSettingsData(url: string): boolean {
  const { pathname, searchParams } = new URL(url);
  return (
    pathname === "/settings.data" &&
    searchParams.get("_routes") === "routes/settings"
  );
}

/** The request is a `<link rel="prefetch">`'s: Chromium marks it Sec-Purpose. */
function isPrefetch(headers: Readonly<Record<string, string>>): boolean {
  return headers["sec-purpose"]?.startsWith("prefetch") ?? false;
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

test("an error page's heading keeps its focus outline", async ({ page }) => {
  const id = await createFixtureUser(page.request);
  await page.goto(`/auth/login?as=${id}&returnTo=/`);
  await waitForHydration(page);
  await expectForcedColours(page);

  const trigger = accountTrigger(page.getByRole("banner"));
  await focusByKeyboard(page, trigger);
  await page.keyboard.press("Enter");
  const settings = (await accountPanel(trigger)).getByRole("link", {
    name: "Settings",
  });
  // The link prefetches the settings data on focus (prefetch="intent"), so
  // the one-off failure is armed only once that prefetch has been answered:
  // armed earlier, the prefetch takes it and the navigation loads the page.
  // The data is no-store, so the navigation fetches it again.
  const prefetched = page.waitForResponse(
    response =>
      isSettingsData(response.url()) && isPrefetch(response.request().headers())
  );
  await focusByKeyboard(page, settings);
  await prefetched;
  await failNext(page.request, {
    userId: id,
    operationId: "listAPITokens",
    status: 500,
    code: "internal",
  });
  const loaded = page.waitForResponse(
    response =>
      isSettingsData(response.url()) &&
      !isPrefetch(response.request().headers())
  );
  await page.keyboard.press("Enter");
  expect((await loaded).status(), "settings data").toBe(500);

  const heading = page.getByRole("main").getByRole("heading", {
    level: 1,
    name: "We couldn’t load your settings",
  });
  await expect(heading).toBeFocused();
  await expectOutlineDrawn(heading);
  await checkpoint(page, "error-heading-focus");
});

test("a facet checkbox keeps its focus outline, and ticked differs from unticked", async ({
  page,
}) => {
  await page.goto("/pieces");
  await waitForHydration(page);
  await expectForcedColours(page);
  const filters = page
    .getByRole("main")
    .getByRole("region", { name: "Filters", exact: true });
  const song = filters.getByRole("checkbox", { name: /^Song, \d+ pieces$/ });
  await focusByKeyboard(page, song);
  await expectOutlineDrawn(song);
  // The system draws the box (appearance: auto), so ticking it changes what
  // is drawn: the native control, not a token colour, shows the state.
  const appearance = await song.evaluate(
    element => getComputedStyle(element).appearance
  );
  expect(appearance).toBe("auto");
  await page.keyboard.press("Space");
  await expect(song).toBeChecked();
  await expect(page).toHaveURL(/\/pieces\?kind=song$/);
});

test("a conservation badge keeps its border and its icon on a piece's page", async ({
  page,
}) => {
  await page.goto("/pieces/the-copper-kettle");
  await waitForHydration(page);
  await expectForcedColours(page);
  const badge = page
    .getByRole("main")
    .getByRole("complementary", { name: "About this piece" })
    .getByRole("link", { name: "Conservation status: Endangered" });
  const { border, icons } = await badge.evaluate(element => ({
    border: getComputedStyle(element).borderStyle,
    icons: element.querySelectorAll("svg").length,
  }));
  expect(border).toBe("solid");
  expect(icons).toBe(1);
  await focusByKeyboard(page, badge);
  await expectOutlineDrawn(badge);
});
