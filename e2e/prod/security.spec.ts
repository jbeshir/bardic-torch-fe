import { expect } from "@playwright/test";
import { collectCspViolations } from "../support/csp";
import { waitForHydration } from "../support/hydration";
import { appBar } from "../support/shell";
import { test } from "../support/test";

test("/ has a nonce CSP that every script carries, and hydrates without violations", async ({
  page,
}) => {
  const violations = collectCspViolations(page);

  const response = await page.goto("/");
  const csp = (await response?.headerValue("content-security-policy")) ?? "";
  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];

  expect(nonce).toBeTruthy();
  expect(csp).not.toContain("'unsafe-inline'");
  expect(csp).toContain("form-action 'self' https://auth0.invalid");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(await response?.headerValue("cache-control")).toBe(
    "private, no-cache"
  );

  const scriptNonces = await page
    .locator("script")
    .evaluateAll(scripts =>
      scripts.map(script => (script as HTMLScriptElement).nonce)
    );
  expect(scriptNonces.length).toBeGreaterThan(0);
  expect(new Set(scriptNonces)).toEqual(new Set([nonce]));

  await waitForHydration(page);
  expect(violations).toEqual([]);
});

test("every load gets a fresh nonce", async ({ request }) => {
  const nonceOf = async () =>
    /'nonce-([^']+)'/.exec(
      (await request.get("/")).headers()["content-security-policy"] ?? ""
    )?.[1];
  expect(await nonceOf()).not.toBe(await nonceOf());
});

test("the 404 page in the shell carries the nonce CSP and hydrates without violations", async ({
  page,
}) => {
  const violations = collectCspViolations(page);
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  expect(await response?.headerValue("content-security-policy")).toMatch(
    /'nonce-([^']+)'/
  );
  await waitForHydration(page);
  // Opening the drawer and the search sheet adds no inline styles either.
  await page.setViewportSize({ width: 360, height: 800 });
  const bar = appBar(page);
  await bar.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("dialog", { name: "Site menu" })).toBeVisible();
  await page.keyboard.press("Escape");
  await bar.getByRole("button", { name: "Search", exact: true }).click();
  await expect(bar.getByRole("searchbox")).toBeFocused();
  expect(violations).toEqual([]);
});

test("the lazy route discovery manifest carries the security headers", async ({
  page,
}) => {
  await page.goto("/");
  await waitForHydration(page);
  // Asked for with the version of the build that served the page, as the
  // page's own route discovery asks for it.
  const version = await page.evaluate(
    () =>
      (window as { __reactRouterManifest?: { version?: string } })
        .__reactRouterManifest?.version
  );
  expect(version).toBeTruthy();
  const response = await page.request.get(
    `/__manifest?paths=%2Fhelp%2Flicence&version=${version ?? ""}`
  );
  expect(response.status()).toBe(200);
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain(
    "frame-ancestors 'none'"
  );
  expect(headers["content-security-policy"]).toMatch(/'nonce-([^']+)'/);
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["vary"]).toMatch(/\bCookie\b/);
  expect(headers["cache-control"]).toBe("public, max-age=31536000, immutable");
  expect(Object.keys((await response.json()) as object)).toContain(
    "routes/help.$slug"
  );
});
