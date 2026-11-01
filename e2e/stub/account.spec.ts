import { expect, type Page } from "@playwright/test";
import { createFixtureUser, failNext } from "../support/fixture-api";
import { waitForHydration } from "../support/hydration";
import { checkpoint } from "../support/journey";
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
        "We couldn't save your changes. Check your connection and try again."
      )
  ).toBeVisible();
  await expect(nameField(page)).not.toHaveAttribute("aria-invalid", "true");
  await page.reload();
  await waitForHydration(page);
  await expect(nameField(page)).toHaveValue("Wynn of the Long Road");
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
    main(page).getByText("Token created. Copy it now — you won't see it again.")
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

  await main(page).getByRole("button", { name: "I've copied it" }).click();
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
    "Anything using ‘E2E laptop’ will stop working straight away. This can't be undone."
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
  await main(page).getByRole("button", { name: "I've copied it" }).click();

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

test("at 10 tokens, creating another says to revoke one first", async ({
  page,
  baseURL,
}) => {
  // The sample user starts with 3; make it 10 through the proxy.
  await openSettings(page);
  for (let index = 0; index < 7; index += 1) {
    const created = await page.request.post("/api/tokens", {
      form: { name: `Bulk ${index + 1}` },
      headers: { Origin: baseURL ?? "" },
    });
    expect(created.status()).toBe(201);
  }
  await page.reload();
  await waitForHydration(page);
  await expect(tokens(page).getByRole("rowheader")).toHaveCount(10);

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
  await expect(tokens(page).getByRole("rowheader")).toHaveCount(10);
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
  await checkpoint(page, "token-revealed");
});

test("checkpoint: revoke-confirm", async ({ page }) => {
  await openSettings(page);
  await tokens(page)
    .getByRole("button", { name: "Revoke token Laptop scripts" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Revoke this token?" })
  ).toBeVisible();
  await checkpoint(page, "revoke-confirm", { target: "dialog[open]" });
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
