import { expect, type Page } from "@playwright/test";
import { createFixtureUser, failNext } from "../support/fixture-api";
import { waitForHydration } from "../support/hydration";
import { checkpoint } from "../support/journey";
import { expectTargetSizesAtLeast24 } from "../support/layout";
import { accountTrigger } from "../support/shell";
import { test } from "../support/test";

/**
 * The settings journey (R25) on a stub build against the fixture API: log
 * in from /settings, change the display name (and the API's 400 and 500
 * through fail injection), create a token, see it once, copy it, revoke
 * it, the 404 of a token already gone and the 10-token limit. Every test
 * signs in its own fresh fixture user, so the file runs in parallel.
 */

test.describe.configure({ mode: "parallel" });
test.use({ viewport: { width: 1280, height: 800 } });

const OFFLINE = "You seem to be offline. Your changes haven’t been saved yet.";

const DISPLAY_NAME_RULE =
  "Use 1 to 64 characters, without control or invisible formatting characters.";

/** A fresh fixture user, signed in and on /settings, hydrated. */
async function openSettings(
  page: Page,
  options: Record<string, unknown> = {}
): Promise<string> {
  const id = await createFixtureUser(page.request, options);
  await page.goto(`/auth/login?as=${id}&returnTo=/settings`);
  await expect(page).toHaveURL(/\/settings$/);
  await waitForHydration(page);
  return id;
}

const main = (page: Page) => page.getByRole("main");
const notifications = (page: Page) =>
  page.getByRole("region", { name: "Notifications" });
const nameField = (page: Page) =>
  main(page).getByRole("textbox", { name: "Display name" });
const tokenNameField = (page: Page) =>
  main(page).getByRole("textbox", { name: /^Token name/ });
const tokens = (page: Page) =>
  main(page).getByRole("table", { name: "Your API tokens" });

/**
 * Press "Create token" and wait for the proxy to answer 201. The reveal
 * only shows after the settings loader has revalidated too, so a failure
 * here says which half was slow or wrong.
 */
async function createToken(page: Page): Promise<void> {
  const response = page.waitForResponse(
    r =>
      r.request().method() === "POST" &&
      new URL(r.url()).pathname === "/api/tokens",
    { timeout: 15_000 }
  );
  await main(page).getByRole("button", { name: "Create token" }).click();
  expect((await response).status(), "POST /api/tokens").toBe(201);
}

test("Log in from settings, then rename: the toast, the account menu, and the API's 400 and 500", async ({
  page,
  baseURL,
}) => {
  const id = await createFixtureUser(page.request, {
    display_name: "Wynn the Watchful",
  });
  const signedOut = await page.goto("/settings");
  expect(await signedOut?.headerValue("cache-control")).toBe("no-store");
  await main(page).getByRole("link", { name: "Log in" }).click();
  // The stub build's chooser; a real build goes to Auth0 here.
  await page.getByLabel("Another fixture user’s id").fill(id);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(`${baseURL}/settings`);
  await waitForHydration(page);

  await expect(nameField(page)).toHaveValue("Wynn the Watchful");
  await nameField(page).fill("  Wynn of the Long Road ");
  await main(page).getByRole("button", { name: "Save changes" }).click();
  await expect(
    notifications(page).getByText("Display name saved.")
  ).toBeVisible();
  await expect(nameField(page)).toHaveValue("Wynn of the Long Road");
  // The root loader ran again, so the header has the new name.
  await expect(accountTrigger(page.getByRole("banner"))).toHaveText(
    /Account: Wynn of the Long Road$/
  );

  // Checked in the browser: nothing is sent.
  await nameField(page).fill("   ");
  await main(page).getByRole("button", { name: "Save changes" }).click();
  await expect(nameField(page)).toHaveAccessibleDescription(
    /Error: Enter a display name\.$/
  );
  await expect(nameField(page)).toBeFocused();
  await expect(nameField(page)).toHaveAttribute("aria-invalid", "true");

  // The API rejects the name: its rule, inline, and focus back on the field.
  await failNext(page.request, {
    userId: id,
    operationId: "updateMe",
    status: 400,
    code: "invalid_request",
  });
  await nameField(page).fill("Wynn of the Marches");
  await main(page).getByRole("button", { name: "Save changes" }).click();
  await expect(nameField(page)).toHaveAccessibleDescription(
    new RegExp(`Error: ${DISPLAY_NAME_RULE}$`)
  );
  await expect(nameField(page)).toHaveAttribute("aria-invalid", "true");
  await expect(nameField(page)).toBeFocused();

  // The API fails: a danger alert, and the old name stays saved.
  await failNext(page.request, {
    userId: id,
    operationId: "updateMe",
    status: 500,
    code: "internal",
  });
  await main(page).getByRole("button", { name: "Save changes" }).click();
  await expect(
    main(page)
      .getByRole("alert")
      .getByText(
        "We couldn’t save your changes. Check your connection and try again."
      )
  ).toBeVisible();
  await expect(nameField(page)).not.toHaveAttribute("aria-invalid", "true");
  await page.reload();
  await waitForHydration(page);
  await expect(nameField(page)).toHaveValue("Wynn of the Long Road");
});

test("a 503 from the platform or no network ends inline in the form, keeping what was typed, never on an error page", async ({
  page,
}) => {
  await openSettings(page, { display_name: "Wynn the Watchful" });

  // Something in front of the app (wrangler, Cloudflare) answers the PATCH
  // with a 503 of its own: not a proxy body, no X-Remix-Response.
  await page.route(
    url => url.pathname === "/api/me",
    route =>
      route.request().method() === "PATCH"
        ? route.fulfill({
            status: 503,
            contentType: "text/html",
            body: "<!doctype html><title>Service unavailable</title>",
          })
        : route.continue()
  );
  await nameField(page).fill("Wynn of the Long Road");
  const patched = page.waitForResponse(
    r =>
      r.request().method() === "PATCH" &&
      new URL(r.url()).pathname === "/api/me"
  );
  await main(page).getByRole("button", { name: "Save changes" }).click();
  expect((await patched).status(), "PATCH /api/me").toBe(503);

  await expect(
    main(page).getByRole("alert").filter({
      hasText:
        "We couldn’t save your changes. Check your connection and try again.",
    })
  ).toBeVisible();
  await expect(nameField(page)).toHaveValue("Wynn of the Long Road");
  await expect(
    main(page).getByRole("heading", { level: 1, name: "Settings", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "We couldn’t load your settings" })
  ).toHaveCount(0);
  await expect(notifications(page).getByText(OFFLINE)).toHaveCount(0);
  // The shell is still the app's: the header kept the saved name.
  await expect(accountTrigger(page.getByRole("banner"))).toHaveText(
    /Account: Wynn the Watchful$/
  );

  // No network at all for the token form: the offline toast as well.
  await page.route(
    url => url.pathname === "/api/tokens",
    route => route.abort("internetdisconnected")
  );
  await tokenNameField(page).fill("Laptop MCP");
  await main(page).getByRole("button", { name: "Create token" }).click();
  await expect(
    main(page).getByText(
      "We couldn’t create a token. Check your connection and try again."
    )
  ).toBeVisible();
  await expect(notifications(page).getByText(OFFLINE)).toBeVisible();
  await expect(tokenNameField(page)).toHaveValue("Laptop MCP");
  await expect(
    main(page).getByRole("textbox", { name: "New token value" })
  ).toHaveCount(0);

  // Back to normal, the same typed name saves.
  await page.unrouteAll();
  await main(page).getByRole("button", { name: "Save changes" }).click();
  await expect(
    notifications(page).getByText("Display name saved.")
  ).toBeVisible();
  await expect(accountTrigger(page.getByRole("banner"))).toHaveText(
    /Account: Wynn of the Long Road$/
  );
});

test("create a token, see it once, copy it, then revoke it after confirming", async ({
  page,
  context,
  baseURL,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: baseURL ?? "",
  });
  await openSettings(page, { tokens: "none" });
  await expect(
    main(page).getByRole("heading", { name: "No tokens yet" })
  ).toBeVisible();

  await tokenNameField(page).fill("E2E laptop");
  await createToken(page);
  const secret = main(page).getByRole("textbox", { name: "New token value" });
  await expect(secret).toBeFocused();
  await expect(
    main(page).getByText("Token created. Copy it now — you won’t see it again.")
  ).toBeVisible();
  const value = await secret.inputValue();
  expect(value).toMatch(/^user_api\|[0-9a-f]{64}$/);
  await expect(
    tokens(page).getByRole("rowheader", { name: "E2E laptop" })
  ).toBeVisible();
  await expect(tokenNameField(page)).toHaveValue("");

  // Exact: "I've copied it" contains "copied".
  await main(page).getByRole("button", { name: "Copy", exact: true }).click();
  await expect(
    main(page).getByRole("button", { name: "Copied", exact: true })
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(value);

  await main(page).getByRole("button", { name: "I’ve copied it" }).click();
  await expect(secret).toHaveCount(0);
  expect(await page.content()).not.toContain(value);
  await expect(
    main(page).getByRole("heading", { level: 2, name: "API tokens" })
  ).toBeFocused();

  const revoke = tokens(page).getByRole("button", {
    name: "Revoke token E2E laptop",
  });
  await revoke.click();
  const dialog = page.getByRole("dialog", { name: "Revoke this token?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(
    "Anything using ‘E2E laptop’ will stop working straight away. This can’t be undone."
  );
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  // Destructive: a press on the backdrop doesn't close it, Escape does.
  await page.mouse.click(5, 5);
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(revoke).toBeFocused();

  await revoke.click();
  await dialog.getByRole("button", { name: "Revoke token" }).click();
  await expect(notifications(page).getByText("Token revoked.")).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(
    main(page).getByRole("heading", { name: "No tokens yet" })
  ).toBeVisible();
  await expect(
    main(page).getByRole("heading", { level: 2, name: "API tokens" })
  ).toBeFocused();
});

test("an unnamed token is listed and confirmed by its prefix; one already gone says so", async ({
  page,
}) => {
  const id = await openSettings(page, { tokens: "none" });
  await createToken(page);
  await expect(
    main(page).getByRole("textbox", { name: "New token value" })
  ).toBeFocused();
  const row = tokens(page).getByRole("rowheader", {
    name: /^Token [0-9a-f]{8}…$/,
  });
  await expect(row).toBeVisible();
  const label = (await row.textContent()) ?? "";
  const prefix = /^Token ([0-9a-f]{8})…$/.exec(label)?.[1] ?? "";
  await main(page).getByRole("button", { name: "I’ve copied it" }).click();

  await tokens(page)
    .getByRole("button", { name: `Revoke token ${label}` })
    .click();
  const dialog = page.getByRole("dialog", { name: "Revoke this token?" });
  await expect(dialog).toContainText(`Anything using token ${prefix}…`);

  await failNext(page.request, {
    userId: id,
    operationId: "revokeAPIToken",
    status: 404,
    code: "not_found",
  });
  await dialog.getByRole("button", { name: "Revoke token" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    main(page)
      .getByRole("alert")
      .getByText(
        "That token no longer exists. Reload the page to see your current tokens."
      )
  ).toBeVisible();
});

test("the count shows the 10-token limit; a stale list still gets the 409; checkpoint: form-errors", async ({
  page,
  baseURL,
}) => {
  const createThroughProxy = async (name: string) => {
    const created = await page.request.post("/api/tokens", {
      form: { name },
      headers: { Origin: baseURL ?? "" },
    });
    expect(created.status()).toBe(201);
  };
  // The sample user starts with 3; make it 9 through the proxy.
  await openSettings(page);
  for (let index = 0; index < 6; index += 1) {
    await createThroughProxy(`Bulk ${index + 1}`);
  }
  await page.reload();
  await waitForHydration(page);
  await expect(tokens(page).getByRole("rowheader")).toHaveCount(9);
  await expect(
    main(page).getByText("You have 9 of 10 API tokens.")
  ).toBeVisible();

  // Another tab takes the tenth: this page's form is out of date, and the
  // API's 409 is the backstop.
  await createThroughProxy("From another tab");
  await tokenNameField(page).fill("One too many");
  await main(page).getByRole("button", { name: "Create token" }).click();
  await expect(
    main(page)
      .getByRole("alert")
      .getByText(
        "You already have 10 API tokens, the most allowed. Revoke one before creating another."
      )
  ).toBeVisible();
  await expect(
    main(page).getByRole("textbox", { name: "New token value" })
  ).toHaveCount(0);
  // A refused create changes nothing, so the list is not reloaded (the
  // settings route's shouldRevalidate): the alert stays with this page's
  // nine, and the form, until the reader reloads.
  await expect(tokens(page).getByRole("rowheader")).toHaveCount(9);
  await expect(
    main(page).getByRole("button", { name: "Create token" })
  ).toBeVisible();

  // Both forms' errors at once, for the record: the name's inline error
  // (checked in the browser) above the token form's alert.
  await nameField(page).fill("   ");
  await main(page).getByRole("button", { name: "Save changes" }).click();
  await expect(nameField(page)).toHaveAccessibleDescription(
    /Error: Enter a display name\.$/
  );
  await expectTargetSizesAtLeast24(page);
  await checkpoint(page, "form-errors");

  // Up to date, at the limit the form gives way to the note.
  await page.reload();
  await waitForHydration(page);
  await expect(
    main(page).getByText("You have 10 of 10 API tokens.")
  ).toBeVisible();
  await expect(
    main(page).getByText(
      "That’s the most allowed. Revoke one to create another."
    )
  ).toBeVisible();
  await expect(
    main(page).getByRole("button", { name: "Create token" })
  ).toHaveCount(0);
});

test("at 320 and 360 the one-time token is shown whole, nothing cut off", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openSettings(page);
  await main(page).getByRole("button", { name: "Create token" }).click();
  const secret = main(page).getByRole("textbox", { name: "New token value" });
  await expect(secret).toBeFocused();
  for (const width of [360, 320]) {
    await page.setViewportSize({ width, height: 800 });
    const fits = await secret.evaluate(
      (box: HTMLTextAreaElement) => box.scrollHeight <= box.clientHeight
    );
    expect(fits, `at ${width}`).toBe(true);
  }
});

test("checkpoint: settings", async ({ page }) => {
  await openSettings(page);
  await expect(tokens(page).getByRole("rowheader")).toHaveCount(3);
  await checkpoint(page, "settings");
});

test("checkpoint: token-revealed", async ({ page }) => {
  await openSettings(page);
  await tokenNameField(page).fill("Laptop MCP");
  await main(page).getByRole("button", { name: "Create token" }).click();
  await expect(
    main(page).getByRole("textbox", { name: "New token value" })
  ).toBeFocused();
  await expectTargetSizesAtLeast24(page);
  await checkpoint(page, "token-revealed");
});

test("checkpoint: profile-unavailable: /v1/me fails, so the profile says so and the tokens still load", async ({
  page,
}) => {
  const id = await openSettings(page);
  await failNext(page.request, {
    userId: id,
    operationId: "getMe",
    status: 500,
    code: "internal",
  });
  await page.reload();
  await waitForHydration(page);
  await expect(
    main(page).getByText(/We couldn’t load your profile\./)
  ).toBeVisible();
  await expect(nameField(page)).toHaveCount(0);
  await expect(tokens(page).getByRole("rowheader")).toHaveCount(3);
  await checkpoint(page, "profile-unavailable");
});

test("checkpoint: blocked: settings says the account is blocked, and offers nothing to change", async ({
  page,
}) => {
  await openSettings(page, { blocked: true });
  // The danger Alert's title is a heading that reads its tone first, and
  // the way forward is a link to the contact form.
  await expect(
    main(page).getByRole("heading", {
      level: 2,
      name: "Error: Your account is blocked",
    })
  ).toBeVisible();
  await expect(
    main(page).getByRole("link", { name: /^contact the Bardic Torch team/ })
  ).toHaveAttribute("href", /^https:\/\/forms\.gle\//);
  await expect(nameField(page)).toHaveCount(0);
  await expect(tokens(page)).toHaveCount(0);
  await checkpoint(page, "blocked");
});

test("checkpoint: revoke-confirm", async ({ page }) => {
  await openSettings(page);
  await tokens(page)
    .getByRole("button", { name: "Revoke token Laptop scripts" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Revoke this token?" })
  ).toBeVisible();
  await expectTargetSizesAtLeast24(page);
  // Axe on the dialog; the capture is the viewport, scrim and placement too.
  await checkpoint(page, "revoke-confirm", {
    target: "dialog[open]",
    viewportOnly: true,
  });
});

test("at 360 the tokens are cards, each with its own Revoke", async ({
  page,
}) => {
  await openSettings(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(tokens(page)).toBeHidden();
  const cards = main(page).getByRole("list", { name: "Your API tokens" });
  await expect(cards.getByRole("heading", { level: 3 })).toHaveText([
    "Songbook importer",
    "Token 9c1e7d3b…",
    "Laptop scripts",
  ]);
  await expect(
    cards.getByRole("button", { name: "Revoke token Token 9c1e7d3b…" })
  ).toBeVisible();
});
