import { expect } from "@playwright/test";
import { test } from "../support/test";

test("AUTH_MODE=stub is ignored: /auth/login goes to Auth0", async ({
  request,
}) => {
  const response = await request.get("/auth/login?as=contributor", {
    maxRedirects: 0,
  });

  expect(response.status()).toBe(302);
  const location = new URL(response.headers()["location"] ?? "");
  expect(`${location.origin}${location.pathname}`).toBe(
    "https://auth0.invalid/authorize"
  );
  const setCookies = response
    .headersArray()
    .filter(({ name }) => name.toLowerCase() === "set-cookie")
    .map(({ value }) => value);
  expect(setCookies.some(value => value.includes("bt_session"))).toBe(false);
});
