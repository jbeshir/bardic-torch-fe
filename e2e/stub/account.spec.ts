import { expect, type Page } from "@playwright/test";
import { createFixtureUser, failNext } from "../support/fixture-api";
import { waitForHydration } from "../support/hydration";
import { checkpoint } from "../support/journey";
import { accountTrigger } from "../support/shell";
import { test } from "../support/test";

/**
 * The settings journey (R25) on a stub build against the fixture API: log
 * in from /settings and change the display name (and the API's 400 and 500
 * through fail injection). Every test signs in its own fresh fixture user,
 * so the file runs in parallel.
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

test("checkpoint: settings", async ({ page }) => {
  await openSettings(page);
  await checkpoint(page, "settings");
});

test("checkpoint: profile-unavailable: /v1/me fails, so the profile says so", async ({
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
  await checkpoint(page, "blocked");
});
