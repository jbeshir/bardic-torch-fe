import { expect } from "@playwright/test";
import { collectCspViolations } from "../support/csp";
import { createFixtureUser } from "../support/fixture-api";
import { waitForHydration } from "../support/hydration";
import { accountPanel, accountTrigger } from "../support/shell";
import { test } from "../support/test";

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

test("Log in opens the fixture-user chooser, which signs in a seeded or a fresh user and returns to the page", async ({
  page,
  baseURL,
}) => {
  const violations = collectCspViolations(page);
  const chooser = await page.goto("/auth/login?returnTo=%2Fhelp");
  expect(chooser?.status()).toBe(200);
  expect(await chooser?.headerValue("cache-control")).toBe("no-store");
  expect(await chooser?.headerValue("content-security-policy")).toContain(
    "frame-ancestors 'none'"
  );
  await expect(page).toHaveTitle("Choose a fixture user · Bardic Torch");
  expect(
    (await page.context().cookies()).some(
      cookie => cookie.name === "__Host-bt_session"
    )
  ).toBe(false);

  await page
    .getByRole("link", { name: /^Log in as the seeded moderator/ })
    .click();
  await expect(page).toHaveURL(`${baseURL}/help`);
  // The URL changes as the document starts to arrive; the header's and the
  // app bar's triggers only hide each other once its stylesheet applies.
  await waitForHydration(page);
  await expect(accountTrigger(page.getByRole("banner"))).toHaveText(
    /Account: Master Tobias Fiddler$/
  );

  const id = await createFixtureUser(page.request, {
    display_name: "Wynn the Watchful",
  });
  await page.goto("/auth/login?returnTo=%2F");
  await page.getByLabel("Another fixture user’s id").fill(id);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(`${baseURL}/`);
  await waitForHydration(page);
  await expect(accountTrigger(page.getByRole("banner"))).toHaveText(
    /Account: Wynn the Watchful$/
  );
  expect(violations).toEqual([]);
});

test.describe("logout", () => {
  // Chromium follows the 302 to Auth0 itself; nothing there can resolve
  // (see LOCAL_ONLY_RESOLVER), so the hop fails locally and the test
  // asserts it instead of the guard failing on it.
  test.use({ offHostRedirects: ["auth0.invalid"] });

  test("Log out posts to /auth/logout, clears the session and goes to Auth0's logout with no CSP violation", async ({
    page,
    baseURL,
  }) => {
    const violations = collectCspViolations(page);
    await page.goto("/auth/login?as=contributor&returnTo=/help");
    await waitForHydration(page);

    const trigger = accountTrigger(page.getByRole("banner"));
    await trigger.click();
    const panel = await accountPanel(trigger);
    const [logout, auth0Hop] = await Promise.all([
      page.waitForResponse(
        response => new URL(response.url()).pathname === "/auth/logout"
      ),
      page.waitForEvent(
        "requestfailed",
        request => new URL(request.url()).hostname === "auth0.invalid"
      ),
      panel.getByRole("button", { name: "Log out" }).click(),
    ]);

    expect(logout.request().method()).toBe("POST");
    expect(logout.status()).toBe(302);
    expect(logout.headers()["cache-control"]).toBe("no-store");
    const target = new URL(logout.headers()["location"] ?? "");
    expect(`${target.origin}${target.pathname}`).toBe(
      "https://auth0.invalid/v2/logout"
    );
    expect(target.searchParams.get("client_id")).toBe("e2e-client-id");
    expect(target.searchParams.get("returnTo")).toBe(baseURL);

    // The browser followed that redirect as the page's navigation: the
    // form-action CSP allowed it (a block would be ERR_BLOCKED_BY_CSP), and
    // it stopped at name resolution, on this machine.
    expect(auth0Hop.url()).toBe(target.href);
    expect(auth0Hop.redirectedFrom()?.url()).toBe(logout.url());
    expect(auth0Hop.isNavigationRequest()).toBe(true);
    expect(auth0Hop.frame()).toBe(page.mainFrame());
    expect(auth0Hop.failure()?.errorText).toBe("net::ERR_NAME_NOT_RESOLVED");

    expect(
      (await page.context().cookies()).some(
        cookie => cookie.name === "__Host-bt_session"
      )
    ).toBe(false);
    expect(violations).toEqual([]);

    await page.goto("/help");
    await expect(
      page.getByRole("banner").getByRole("link", { name: "Log in" })
    ).toHaveAttribute("href", "/auth/login?returnTo=%2Fhelp");
  });
});
