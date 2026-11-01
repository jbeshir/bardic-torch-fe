import { expect } from "@playwright/test";
import { checkpoint } from "../support/journey";
import {
  expectFocusNotObscured,
  expectNoHorizontalOverflow,
  expectTargetSizesAtLeast24,
} from "../support/layout";
import { HOME_HEADLINE } from "../support/pages";
import { waitForHydration } from "../support/hydration";
import { test } from "../support/test";

// Every test opens its own page and shares no state, so they spread over
// the workers instead of queueing behind this file's checkpoints.
test.describe.configure({ mode: "parallel" });

test("an unknown URL is a 404 page inside the shell", async ({ page }) => {
  const response = await page.goto("/wiki/Ballad_of_the_Bell");

  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle("Page not found · Bardic Torch");
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", { level: 1, name: "We couldn't find that page" })
  ).toBeVisible();
  await expect(
    main.getByRole("link", { name: "Go to the home page" })
  ).toHaveAttribute("href", "/");
  await expect(
    main.getByRole("link", { name: /Look on the original wiki/ })
  ).toHaveAttribute("href", /index\.php\?search=Ballad\+of\+the\+Bell$/);

  // The shell is all there: header, site nav and footer with its help links.
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Site" })).toBeVisible();
  await expect(
    page.getByRole("contentinfo").getByRole("list", { name: "Help" })
  ).toBeVisible();

  await checkpoint(page, "not-found");
});

test("the 404 page reflows, its targets are big enough and focus is never hidden", async ({
  page,
}) => {
  const response = await page.goto("/wiki/Ballad_of_the_Bell");
  expect(response?.status()).toBe(404);
  await waitForHydration(page);
  await expectNoHorizontalOverflow(page);
  await expectTargetSizesAtLeast24(page);
  await expectFocusNotObscured(page);
});

test("going home from the 404 page works", async ({ page }) => {
  await page.goto("/no-such-page");
  await page
    .getByRole("main")
    .getByRole("link", { name: "Go to the home page" })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { level: 1, name: HOME_HEADLINE })
  ).toBeVisible();
});

test("the styleguide is not part of the production build", async ({ page }) => {
  const response = await page.goto("/styleguide");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { level: 1, name: "We couldn't find that page" })
  ).toBeVisible();
});
