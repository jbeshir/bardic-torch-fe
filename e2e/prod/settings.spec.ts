import { expect } from "@playwright/test";
import { waitForHydration } from "../support/hydration";
import { checkpoint } from "../support/journey";
import {
  expectFocusNotObscured,
  expectNoHorizontalOverflow,
  expectPrimaryTargetsAtLeast44,
  expectTargetSizesAtLeast24,
} from "../support/layout";
import { test } from "../support/test";

/**
 * /settings on the production build, signed out (R25): a prompt to log in
 * that comes back here, never cached. The signed-in journey needs stub
 * sign-in, so it is stub/account.spec.ts.
 */

test.describe.configure({ mode: "parallel" });

test("signed out, settings offers Log in back to it and is never cached", async ({
  page,
}) => {
  const response = await page.goto("/settings");
  expect(response?.status()).toBe(200);
  expect(await response?.headerValue("cache-control")).toBe("no-store");
  await expect(page).toHaveTitle("Settings · Bardic Torch");
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", { level: 1, name: "Settings" })
  ).toBeVisible();
  await expect(
    main.getByText(
      "Log in to change your display name and manage your API tokens."
    )
  ).toBeVisible();
  await expect(main.getByRole("link", { name: "Log in" })).toHaveAttribute(
    "href",
    "/auth/login?returnTo=%2Fsettings"
  );
  await expect(main.getByRole("textbox")).toHaveCount(0);
  await checkpoint(page, "signed-out");
});

test("signed out, settings reflows, its targets are big enough and focus is never hidden", async ({
  page,
}) => {
  await page.goto("/settings");
  await waitForHydration(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await expectPrimaryTargetsAtLeast44([
    page.getByRole("main").getByRole("link", { name: "Log in" }),
  ]);
  await expectNoHorizontalOverflow(page);
  await expectTargetSizesAtLeast24(page);
  await expectFocusNotObscured(page);
});
