import { expect, type APIRequestContext } from "@playwright/test";
import { FIXTURE_API_URL } from "../support/fixture-api";
import { test } from "../support/test";

/** Create an isolated fixture user, so specs never share state. */
async function createFixtureUser(
  request: APIRequestContext,
  options: Record<string, unknown> = {}
): Promise<string> {
  const response = await request.post(`${FIXTURE_API_URL}/__fixtures/users`, {
    data: options,
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

const FORM = "application/x-www-form-urlencoded";

test("stub sign-in as the seeded contributor sets the session cookie and returns home", async ({
  page,
  context,
  baseURL,
}) => {
  await page.goto("/auth/login?as=contributor");

  expect(page.url()).toBe(`${baseURL}/`);
  const session = (await context.cookies()).find(
    cookie => cookie.name === "__Host-bt_session"
  );
  expect(session).toMatchObject({
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
  });
});

test("stub sign-in honours a safe returnTo and ignores an unsafe one", async ({
  page,
  baseURL,
}) => {
  await page.goto("/auth/login?as=contributor&returnTo=/no-such-page");
  expect(page.url()).toBe(`${baseURL}/no-such-page`);

  await page.goto("/auth/login?as=contributor&returnTo=//evil.example/");
  expect(page.url()).toBe(`${baseURL}/`);
});

test("a fresh fixture user's session reaches the fixture API through the proxy", async ({
  page,
  baseURL,
}) => {
  const id = await createFixtureUser(page.request, {
    display_name: "Wynn the Watchful",
  });

  await page.goto(`/auth/login?as=${id}`);
  const response = await page.request.patch("/api/me", {
    form: { display_name: "  Wynn of the Long Road  " },
    headers: { Origin: baseURL ?? "" },
  });

  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(await response.json()).toEqual({
    ok: true,
    data: {
      id: `fixture|${id}`,
      display_name: "Wynn of the Long Road",
      role: "contributor",
    },
  });
});

test("an API token can be created once and revoked through the proxy", async ({
  page,
  baseURL,
}) => {
  const id = await createFixtureUser(page.request, { tokens: "none" });
  await page.goto(`/auth/login?as=${id}`);

  const created = await page.request.post("/api/tokens", {
    form: { name: "E2E runner" },
    headers: { Origin: baseURL ?? "" },
  });
  expect(created.status()).toBe(201);
  const { data } = (await created.json()) as {
    data: { id: string; name: string; token: string };
  };
  expect(data.name).toBe("E2E runner");
  expect(data.token).toMatch(/^user_api\|[0-9a-f]{64}$/);

  const revoked = await page.request.delete(
    `/api/tokens/${encodeURIComponent(data.id)}`,
    { headers: { Origin: baseURL ?? "", "Content-Type": FORM }, data: "" }
  );
  expect(revoked.status()).toBe(200);
  expect(await revoked.json()).toEqual({ ok: true, data: null });
});

test("a blocked fixture user gets the app's blocked message", async ({
  page,
  baseURL,
}) => {
  const id = await createFixtureUser(page.request, { blocked: true });
  await page.goto(`/auth/login?as=${id}`);

  const response = await page.request.patch("/api/me", {
    form: { display_name: "Anyone" },
    headers: { Origin: baseURL ?? "" },
  });
  expect(response.status()).toBe(403);
  expect(await response.json()).toMatchObject({
    ok: false,
    error: {
      code: "user_blocked",
      message: expect.stringMatching(/^Your account is blocked/),
    },
  });
});

test("a cross-site PATCH is refused even with a session", async ({ page }) => {
  await page.goto("/auth/login?as=contributor");
  const response = await page.request.patch("/api/me", {
    form: { display_name: "Forged" },
    headers: { Origin: "https://evil.example" },
  });
  expect(response.status()).toBe(403);
});
