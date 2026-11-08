import { expect } from "@playwright/test";
import { outageNext } from "../support/fixture-api";
import { waitForHydration } from "../support/hydration";
import { checkpoint } from "../support/journey";
import { openServerError } from "../support/journey-pages";
import { HOME_HEADLINE } from "../support/pages";
import { test } from "../support/test";

// Every test opens its own page and shares no state, so they spread over
// the workers instead of queueing behind this file's checkpoints.
test.describe.configure({ mode: "parallel" });

test("an unknown URL is a 404 page inside the shell", async ({ page }) => {
  const response = await page.goto("/wiki/Ballad_of_the_Bell");

  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle("Page not found · Bardic Torch");
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", { level: 1, name: "We couldn’t find that page" })
  ).toBeVisible();
  await expect(
    main.getByRole("link", { name: "Go to the home page" })
  ).toHaveAttribute("href", "/");
  await expect(
    main.getByRole("link", { name: /Look on the original wiki/ })
  ).toHaveAttribute("href", /index\.php\?search=Ballad\+of\+the\+Bell$/);
  // The catalogue's own search for the address's last part (C3.2).
  await expect(
    main.getByRole("link", {
      name: "Search for ‘Ballad of the Bell’",
    })
  ).toHaveAttribute("href", "/search?q=Ballad+of+the+Bell");

  // The shell is all there: header, site nav and footer with its help links.
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Site" })).toBeVisible();
  await expect(
    page.getByRole("contentinfo").getByRole("list", { name: "Help" })
  ).toBeVisible();

  await checkpoint(page, "not-found");
});

test("an unexpected error is the standalone error page, and Try again recovers", async ({
  page,
}) => {
  await openServerError(page);
  await expect(page).toHaveTitle("Something went wrong · Bardic Torch");
  const main = page.getByRole("main");
  // Not the shell: the root failed, so the page is its own.
  await expect(page.getByRole("navigation", { name: "Site" })).toHaveCount(0);
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Bardic Torch" })
  ).toHaveAttribute("href", "/");
  await expect(main).toContainText("That’s on us, not you.");
  // Without Sentry there is no reference to quote.
  await expect(main).not.toContainText("reference");
  await expect(
    main.getByRole("link", { name: "Go to the home page" })
  ).toHaveAttribute("href", "/");
  await expect(
    page.getByRole("contentinfo").getByRole("list", { name: "Help" })
  ).toBeVisible();
  // At desktop widths the body is a centred sheet, not hugging the left edge.
  const viewport = page.viewportSize();
  const sheet = await main.locator(":scope > div").boundingBox();
  if (viewport && viewport.width >= 1024 && sheet) {
    const left = sheet.x;
    const right = viewport.width - (sheet.x + sheet.width);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(16);
  }
  await checkpoint(page, "server-error");

  await page.unrouteAll();
  await main.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Licence & attribution" })
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Site" })).toBeVisible();
});

test("going home from the 404 page works", async ({ page }) => {
  await page.goto("/no-such-page");
  await page
    .getByRole("main")
    .getByRole("link", { name: "Go to the home page" })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { level: 1, name: HOME_HEADLINE })
  ).toBeVisible();
});

test("the styleguide is not part of the production build", async ({ page }) => {
  const response = await page.goto("/styleguide");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { level: 1, name: "We couldn’t find that page" })
  ).toBeVisible();
});

test("checkpoint: resting, the catalogue out of reach is a 503 with Retry-After", async ({
  page,
  request,
}) => {
  const q = `resting-${test.info().workerIndex}-${Date.now()}`;
  await outageNext(request, {
    operationId: "listPieces",
    match: { q },
    mode: "503",
  });
  const response = await page.goto(`/pieces?q=${q}`);
  expect(response?.status()).toBe(503);
  await waitForHydration(page);
  expect(await response?.headerValue("retry-after")).toBe("60");
  expect(await response?.headerValue("cache-control")).toBe(
    "private, no-cache"
  );
  await expect(page).toHaveTitle("Bardic Torch is resting · Bardic Torch");
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", { level: 1, name: "Bardic Torch is resting" })
  ).toBeVisible();
  await expect(main).toContainText("briefly unreachable");
  // Inside the shell: the site nav still works while the catalogue rests.
  await expect(page.getByRole("navigation", { name: "Site" })).toBeVisible();
  await expect(main).not.toContainText("Reference");
  await checkpoint(page, "resting");

  // The outage was for one request: Try again brings the page back.
  await main.getByRole("button", { name: "Try again" }).click();
  await expect(
    main.getByRole("heading", { name: `Nothing matches ‘${q}’` })
  ).toBeVisible();
});

// ---------------------------------------------------------------------------
// C3.2: the 404 page's search

test("an old wiki address searches the catalogue for its page", async ({
  page,
}) => {
  const response = await page.goto("/wiki/Northmarch_Rising");
  expect(response?.status()).toBe(404);
  await waitForHydration(page);
  const main = page.getByRole("main");
  await main
    .getByRole("link", { name: "Search for ‘Northmarch Rising’" })
    .click();
  await expect(page).toHaveURL(/\/search\?q=Northmarch\+Rising$/);
  await expect(
    main.getByRole("region", { name: "Pieces" }).getByRole("link", {
      name: "Northmarch Rising",
    })
  ).toBeVisible();
});
