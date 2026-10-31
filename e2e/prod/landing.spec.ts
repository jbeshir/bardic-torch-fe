import { expect } from "@playwright/test";
import { checkpoint } from "../support/journey";
import {
  expectFocusNotObscured,
  expectNoHorizontalOverflow,
  expectTargetSizesAtLeast24,
} from "../support/layout";
import { test } from "../support/test";

test("the home page renders from the production build", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: "Bardic Torch" })
  ).toBeVisible();
  await expect(page).toHaveTitle("Bardic Torch");
  await checkpoint(page, "home");
  await expectNoHorizontalOverflow(page);
  await expectTargetSizesAtLeast24(page);
  await expectFocusNotObscured(page);
});
