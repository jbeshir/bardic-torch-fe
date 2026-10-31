import { expect } from "@playwright/test";
import { test } from "../support/test";

test("an unknown URL is a 404 page", async ({ page }) => {
  const response = await page.goto("/no-such-page");

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { level: 1, name: "Page not found" })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
});

test("the styleguide is not part of the production build", async ({ page }) => {
  const response = await page.goto("/styleguide");
  expect(response?.status()).toBe(404);
});
