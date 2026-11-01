import { expect } from "@playwright/test";
import { checkpoint } from "../support/journey";
import { expectNoLayoutShift } from "../support/layout";
import { HOME_HEADLINE } from "../support/pages";
import { waitForHydration } from "../support/hydration";
import { test } from "../support/test";

// Every test opens its own page and shares no state, so they spread over
// the workers instead of queueing behind this file's checkpoints.
test.describe.configure({ mode: "parallel" });

test("the home page renders from the production build", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(
    page
      .getByRole("main")
      .getByRole("heading", { level: 1, name: HOME_HEADLINE })
  ).toBeVisible();
  await expect(page).toHaveTitle("Bardic Torch");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /^A community index of SCA bardic songs, stories and poems/
  );
  await checkpoint(page, "home");
});

test("the home page says what the site is and leads to contributing here, then to the wiki", async ({
  page,
}) => {
  await page.goto("/");
  const main = page.getByRole("main");

  // Mission: an index, not an archive; links only; conservation; anyone can
  // contribute, with moderation; not affiliated.
  const why = main.getByRole("region", { name: "Why Bardic Torch" });
  await expect(why.getByRole("heading", { level: 3 })).toHaveText([
    "An index, not an archive",
    "Every version, everywhere",
    "Anyone can contribute",
  ]);
  await expect(why).toContainText("We never host lyrics, recordings or video");
  await expect(
    why.getByRole("link", { name: "How conservation statuses work" })
  ).toHaveAttribute("href", "/help/conservation-status");
  await expect(
    main.getByText(
      "Information: Bardic Torch is community-maintained and not affiliated with the Society for Creative Anachronism or any other organisation."
    )
  ).toBeVisible();

  // Until the catalogue opens, browsing is on the original wiki.
  const browse = main.getByRole("link", {
    name: "Browse on the original wiki (opens original wiki)",
  });
  await expect(browse).toHaveAttribute("href", /\/wiki\/Category:Pieces$/);
  const chips = main
    .getByRole("region", { name: "Start exploring on the original wiki" })
    .getByRole("link");
  await expect(chips).toHaveCount(8);
  await expect(chips.first()).toHaveAttribute(
    "href",
    /\/wiki\/Category:Genres$/
  );
  await expect(
    main.getByRole("search").getByRole("searchbox", {
      name: "Search the original wiki",
    })
  ).toBeVisible();

  // The primary action stays on this site.
  await main.getByRole("link", { name: "How to contribute" }).first().click();
  await expect(page).toHaveURL(/\/help\/contributing$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Contributing guide" })
  ).toBeVisible();
});

test("the shell has one of each landmark and a skip link to the content", async ({
  page,
}) => {
  await page.goto("/");
  // Hydration hides the sidebar below lg, which changes the Tab order.
  await waitForHydration(page);
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("contentinfo")).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "Site" })).toHaveCount(1);

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.keyboard.press("Tab");
  // The next stop is inside the content (or after it), not back in the header.
  const inHeader = await page.evaluate(
    () =>
      document.querySelector("header")?.contains(document.activeElement) ??
      false
  );
  expect(inHeader).toBe(false);
});

test("the header links home, searches the wiki and has the theme and Log in from md", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/help");
  const banner = page.getByRole("banner");
  await expect(
    banner.getByRole("link", { name: "Bardic Torch" })
  ).toHaveAttribute("href", "/");
  const search = banner.getByRole("search");
  await expect(search).toHaveAttribute("method", "get");
  await expect(
    search.getByRole("searchbox", { name: "Search the original wiki" })
  ).toHaveAttribute("name", "search");
  await expect(banner.getByRole("group", { name: "Theme" })).toBeVisible();
  await expect(banner.getByRole("link", { name: "Log in" })).toHaveAttribute(
    "href",
    "/auth/login?returnTo=%2Fhelp"
  );
});

test("the footer has the licence, the non-affiliation statement and the help links", async ({
  page,
}) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await expect(
    footer.getByRole("link", {
      name: /Creative Commons Attribution-ShareAlike 4\.0/,
    })
  ).toHaveAttribute("href", "https://creativecommons.org/licenses/by-sa/4.0/");
  await expect(footer).toContainText(
    "Bardic Torch is community-maintained and not affiliated with the Society for Creative Anachronism or any other organisation."
  );
  await expect(
    footer.getByRole("list", { name: "Help" }).getByRole("link")
  ).toHaveText([/^Contact/, "Help", "Licence & attribution", /^Original wiki/]);
});

test("at 360 the hero buttons stack full width, primary first", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  const main = page.getByRole("main");
  const contribute = main
    .getByRole("link", { name: "How to contribute" })
    .first();
  const browse = main.getByRole("link", {
    name: "Browse on the original wiki (opens original wiki)",
  });
  const search = main.getByRole("searchbox", {
    name: "Search the original wiki",
  });
  const [first, second, field] = await Promise.all(
    [contribute, browse, search].map(locator => locator.boundingBox())
  );
  expect(first && second && field).toBeTruthy();
  if (first && second && field) {
    expect(first.y + first.height).toBeLessThanOrEqual(second.y);
    expect(second.y + second.height).toBeLessThanOrEqual(field.y);
    expect(Math.abs(first.width - second.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(first.x - second.x)).toBeLessThanOrEqual(1);
  }
});

// CLS = 0 (plan §0.11): at 360 and 768 hydration hides the no-JS site menu
// after the content; at 1280 the sidebar stays.
for (const viewport of [
  { width: 360, height: 800 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
]) {
  test(`at ${viewport.width}px nothing on the home page moves as it loads, fonts and hydration included`, async ({
    page,
  }) => {
    await expectNoLayoutShift(page, "/", viewport);
  });
}
