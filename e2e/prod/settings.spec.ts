import { expect } from "@playwright/test";
import { collectCspViolations } from "../support/csp";
import { waitForHydration } from "../support/hydration";
import { checkpoint } from "../support/journey";
import { test } from "../support/test";

/**
 * /settings on the production build, signed out (R25): a prompt to log in
 * that comes back here, never cached. The signed-in journey needs stub
 * sign-in, so it is stub/account.spec.ts.
 */

test("signed out, settings offers Log in back to it, is never cached and has the nonce CSP", async ({
  page,
}) => {
  const violations = collectCspViolations(page);
  const response = await page.goto("/settings");
  expect(response?.status()).toBe(200);
  expect(await response?.headerValue("cache-control")).toBe("no-store");
  const csp = (await response?.headerValue("content-security-policy")) ?? "";
  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
  expect(nonce).toBeTruthy();
  expect(csp).not.toContain("'unsafe-inline'");
  expect(csp).toContain("form-action 'self' https://auth0.invalid");
  expect(csp).toContain("frame-ancestors 'none'");
  const scriptNonces = await page
    .locator("script")
    .evaluateAll(scripts =>
      scripts.map(script => (script as HTMLScriptElement).nonce)
    );
  expect(new Set(scriptNonces)).toEqual(new Set([nonce]));
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
  await waitForHydration(page);
  expect(violations).toEqual([]);
  await checkpoint(page, "signed-out");
});

test("a form posted to /settings itself (no JS) says settings need JavaScript, not that they failed to load", async ({
  page,
}) => {
  const response = await page.request.post("/settings", {
    form: { intent: "update-profile", displayName: "Someone" },
  });
  expect(response.status()).toBe(405);
  const html = await response.text();
  expect(html).toContain("Changing your settings needs JavaScript");
  expect(html).not.toContain("We couldn’t load your settings");
});
