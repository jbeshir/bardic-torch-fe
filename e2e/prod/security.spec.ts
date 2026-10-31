import { expect } from "@playwright/test";
import { test } from "../support/test";

test("/ has a nonce CSP that every script carries, and hydrates without violations", async ({
  page,
}) => {
  const violations: string[] = [];
  page.on("console", message => {
    if (message.text().includes("Content Security Policy")) {
      violations.push(message.text());
    }
  });

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

  await expect
    .poll(() => page.evaluate(() => "__remixRouter" in window))
    .toBe(true);
  expect(violations).toEqual([]);
});

test("every load gets a fresh nonce", async ({ request }) => {
  const nonceOf = async () =>
    /'nonce-([^']+)'/.exec(
      (await request.get("/")).headers()["content-security-policy"] ?? ""
    )?.[1];
  expect(await nonceOf()).not.toBe(await nonceOf());
});
