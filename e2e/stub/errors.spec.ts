import { expect, type Page } from "@playwright/test";
import { createFixtureUser, failNext } from "../support/fixture-api";
import { waitForHydration } from "../support/hydration";
import { checkpoint } from "../support/journey";
import { accountPanel, accountTrigger } from "../support/shell";
import { HOME_HEADLINE } from "../support/pages";
import { test } from "../support/test";

/**
 * The root loader's /v1/me failing (R26, R27): pages still render, and the
 * account control says what went wrong instead of failing the page.
 */

/** The header's account trigger (at 1280 the bar's copy is display: none). */
function headerAccount(page: Page) {
  return accountTrigger(page.getByRole("banner"));
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
  await waitForHydration(page);
  await expect(
    page.getByRole("heading", { level: 1, name: HOME_HEADLINE })
  ).toBeVisible();
  const trigger = headerAccount(page);
  await expect(trigger).toHaveText("Account");

  await trigger.click();
  const panel = await accountPanel(trigger);
  const warning = panel.getByText("Warning: We couldn't load your profile.");
  await expect(warning).toBeVisible();
  await expect(panel.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Log out" })).toBeVisible();
  await checkpoint(page, "profile-unavailable");

  // The failure was a one-off: Try again reloads the profile in place.
  await trigger.click();
  await expect(warning).toBeHidden();
  await trigger.click();
  await panel.getByRole("button", { name: "Try again" }).click();
  await expect(trigger).toHaveText(/Account: .+/);
  await expect(warning).toHaveCount(0);
});

test("a blocked account is told so in the account panel", async ({ page }) => {
  const id = await createFixtureUser(page.request, { blocked: true });
  await page.goto(`/auth/login?as=${id}&returnTo=/`);
  await waitForHydration(page);

  await expect(
    page.getByRole("heading", { level: 1, name: HOME_HEADLINE })
  ).toBeVisible();
  const trigger = headerAccount(page);
  await trigger.click();
  const panel = await accountPanel(trigger);
  // The danger Alert reads its tone first ("Error: ").
  await expect(
    panel.getByText(/^Error: Your account is blocked/)
  ).toBeVisible();
  await expect(panel.getByRole("link", { name: "Settings" })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Log out" })).toBeVisible();
});
