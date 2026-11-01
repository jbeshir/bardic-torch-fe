import { expect } from "@playwright/test";
import { checkpoint } from "../support/journey";
import {
  expectFocusNotObscured,
  expectNoHorizontalOverflow,
  expectPrimaryTargetsAtLeast44,
  expectTargetSizesAtLeast24,
} from "../support/layout";
import { HOME_HEADLINE } from "../support/pages";
import { appBar } from "../support/shell";
import { test } from "../support/test";

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
  await expectNoHorizontalOverflow(page);
  await expectTargetSizesAtLeast24(page);
  await expectFocusNotObscured(page);
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

test("at 360 the hero buttons stack full width, primary first, and the primary controls are 44 px", async ({
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
  const bar = appBar(page);
  await expectPrimaryTargetsAtLeast44([
    contribute,
    browse,
    search,
    page.getByRole("banner").getByRole("link", { name: "Bardic Torch" }),
    bar
      .getByRole("button", { name: "Menu" })
      .or(bar.getByRole("link", { name: "Menu" })),
    bar
      .getByRole("button", { name: "Search", exact: true })
      .or(bar.getByRole("link", { name: "Search", exact: true })),
    bar.getByRole("link", { name: "Log in" }),
  ]);
  await expectNoHorizontalOverflow(page);
});
