import { expect } from "@playwright/test";
import { createFixtureUser } from "../support/fixture-api";
import { accountTrigger, appBar } from "../support/shell";
import { test } from "../support/test";

/**
 * The signed-in journeys with scripting off (plan §0.11; the stub-no-js
 * project disables JavaScript for the context): the account control is a
 * plain disclosure, and settings says its changes need JavaScript. The
 * signed-out ones are prod/no-js.spec.ts.
 */

test("below md the account panel opens and closes from its summary", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/auth/login?as=contributor&returnTo=/");
  const account = accountTrigger(appBar(page));
  await expect(account).toHaveText(/Account: Morwen of the Marches$/);
  await account.click();
  await expect(
    appBar(page).getByRole("button", { name: "Log out" })
  ).toBeVisible();
  await account.click();
  await expect(
    appBar(page).getByRole("button", { name: "Log out" })
  ).toBeHidden();
});

test("settings says changes need JavaScript, and its buttons wait for it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const id = await createFixtureUser(page.request);
  await page.goto(`/auth/login?as=${id}&returnTo=/settings`);
  await expect(page).toHaveURL(/\/settings$/);
  const main = page.getByRole("main");
  // Playwright's text and role engines skip <noscript>, so the notice is
  // found by CSS. With scripting off it is parsed as markup and rendered.
  const notice = main.locator("noscript > div");
  await expect(notice).toBeVisible();
  await expect(notice).toHaveText(
    "Warning: Changing your settings needs JavaScript. Everything else on Bardic Torch works without it."
  );
  await expect(main.getByRole("textbox", { name: "Display name" })).toHaveValue(
    /.+/
  );
  await expect(
    main.getByRole("button", { name: "Save changes" })
  ).toBeDisabled();
  await expect(
    main.getByRole("button", { name: "Create token" })
  ).toBeDisabled();
  await expect(
    main
      .getByRole("table", { name: "Your API tokens" })
      .getByRole("button", { name: "Revoke token Laptop scripts" })
  ).toBeDisabled();
});
