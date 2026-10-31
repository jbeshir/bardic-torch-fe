import { expect, type Page } from "@playwright/test";
import { createFixtureUser, failNext } from "../support/fixture-api";
import { checkpoint } from "../support/journey";
import { test } from "../support/test";

/**
 * The root loader's /v1/me failing (R26, R27): pages still render, and the
 * account control says what went wrong instead of failing the page.
 */

function accountTrigger(page: Page) {
  return page.getByRole("banner").locator("summary").first();
}

test.use({ viewport: { width: 1280, height: 800 } });

test("a /v1/me 500 leaves the page working, with the profile warning and Try again", async ({
  page,
}) => {
  const id = await createFixtureUser(page.request);
  await page.goto(`/auth/login?as=${id}&returnTo=/`);
  await failNext(page.request, {
    userId: id,
    operationId: "getMe",
    status: 500,
    code: "internal",
  });

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: "Bardic Torch" })
  ).toBeVisible();
  const trigger = accountTrigger(page);
  await expect(trigger).toHaveText("Account");

  await trigger.click();
  const banner = page.getByRole("banner");
  await expect(
    banner.getByText("We couldn't load your profile.")
  ).toBeVisible();
  await expect(banner.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(banner.getByRole("button", { name: "Log out" })).toBeVisible();
  await checkpoint(page, "profile-unavailable");

  // The failure was a one-off: Try again reloads the profile in place.
  await accountTrigger(page).click();
  await expect(banner.getByText("We couldn't load your profile.")).toBeHidden();
  await accountTrigger(page).click();
  await banner.getByRole("button", { name: "Try again" }).click();
  await expect(accountTrigger(page)).toHaveText(/Account: /);
});

test("a blocked account is told so in the account panel", async ({ page }) => {
  const id = await createFixtureUser(page.request, { blocked: true });
  await page.goto(`/auth/login?as=${id}&returnTo=/`);

  await expect(
    page.getByRole("heading", { level: 1, name: "Bardic Torch" })
  ).toBeVisible();
  await accountTrigger(page).click();
  const banner = page.getByRole("banner");
  await expect(banner.getByText(/^Your account is blocked/)).toBeVisible();
  await expect(banner.getByRole("link", { name: "Settings" })).toBeHidden();
  await expect(banner.getByRole("button", { name: "Log out" })).toBeVisible();
});
