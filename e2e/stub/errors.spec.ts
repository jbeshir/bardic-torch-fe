import { expect, type Page } from "@playwright/test";
import { createFixtureUser, failNext } from "../support/fixture-api";
import { waitForHydration } from "../support/hydration";
import { checkpoint } from "../support/journey";
import {
  accountPanel,
  accountTrigger,
  openShownAccountPanel,
} from "../support/shell";
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
  const warning = panel.getByText("Warning: We couldn’t load your profile.");
  await expect(warning).toBeVisible();
  await expect(panel.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Log out" })).toBeVisible();
  await checkpoint(page, "profile-unavailable", {
    atEachViewport: openShownAccountPanel,
    viewportOnly: true,
  });

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

test("settings route boundary on GET /v1/tokens 500 while root degrades on /v1/me 500", async ({
  page,
}) => {
  const id = await createFixtureUser(page.request);
  await page.goto(`/auth/login?as=${id}&returnTo=/`);
  for (const operationId of ["listAPITokens", "getMe"]) {
    await failNext(page.request, {
      userId: id,
      operationId,
      status: 500,
      code: "internal",
    });
  }

  const response = await page.goto("/settings");
  expect(response?.status()).toBe(500);
  expect(await response?.headerValue("cache-control")).toBe("no-store");
  // The shell (root) still renders, with its own degraded account control.
  await waitForHydration(page);
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Site" })).toBeVisible();
  await expect(headerAccount(page)).toHaveText("Account");
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", {
      level: 1,
      name: "We couldn’t load your settings",
    })
  ).toBeVisible();
  await expect(
    main.getByRole("link", { name: "Go to the home page" })
  ).toBeVisible();
  // Exact: the boundary's own h1 ends in "settings".
  await expect(
    page.getByRole("heading", { level: 1, name: "Settings", exact: true })
  ).toHaveCount(0);
  await checkpoint(page, "settings-error");

  // Both failures were one-offs: Try again reloads the page's data and the
  // root's in place.
  await main.getByRole("button", { name: "Try again" }).click();
  await expect(
    main.getByRole("heading", { level: 1, name: "Settings", exact: true })
  ).toBeVisible();
  await expect(
    main.getByRole("table", { name: "Your API tokens" })
  ).toBeVisible();
  await expect(headerAccount(page)).toHaveText(/Account: .+/);
});
