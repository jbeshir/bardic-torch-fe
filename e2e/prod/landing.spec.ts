import { expect } from "@playwright/test";
import { checkpoint } from "../support/journey";
import {
  expectFocusNotObscured,
  expectNoHorizontalOverflow,
  expectPrimaryTargetsAtLeast44,
  expectTargetSizesAtLeast24,
} from "../support/layout";
import { appBar } from "../support/shell";
import { test } from "../support/test";

test("the home page renders from the production build", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(
    page
      .getByRole("main")
      .getByRole("heading", { level: 1, name: "Bardic Torch" })
  ).toBeVisible();
  await expect(page).toHaveTitle("Bardic Torch");
  await checkpoint(page, "home");
  await expectNoHorizontalOverflow(page);
  await expectTargetSizesAtLeast24(page);
  await expectFocusNotObscured(page);
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

test("at 360 the primary controls are 44 px and nothing overflows", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  const bar = appBar(page);
  await expectPrimaryTargetsAtLeast44([
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
