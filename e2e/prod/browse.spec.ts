import { expect, type Page } from "@playwright/test";
import { failNext } from "../support/fixture-api";
import { waitForHydration } from "../support/hydration";
import { checkpoint } from "../support/journey";
import { test } from "../support/test";

/**
 * `/pieces`, the A–Z of every piece (plan §4.2), against the fixture
 * catalogue: 249 pieces (5 pages), T with 5, Q with none. Failures are
 * injected with a `match` on a search unique to the test, so parallel
 * workers never see each other's. The resting page's checkpoint is
 * errors.spec.ts's.
 */

// Every test opens its own page and shares no state, so they spread over
// the workers instead of queueing behind this file's checkpoints.
test.describe.configure({ mode: "parallel" });

const main = (page: Page) => page.getByRole("main");
const letters = (page: Page) =>
  main(page).getByRole("navigation", { name: "Pieces by letter" });

async function open(page: Page, path: string, status = 200) {
  const response = await page.goto(path);
  expect(response?.status(), `GET ${path}`).toBe(status);
  await waitForHydration(page);
}

test("checkpoint: index, every piece by title with the A–Z", async ({
  page,
}) => {
  await open(page, "/pieces");
  await expect(page).toHaveTitle("Pieces · Bardic Torch");
  await expect(
    main(page).getByRole("heading", { level: 1, name: "Pieces" })
  ).toBeVisible();
  await expect(main(page)).toContainText("249 pieces");
  await expect(letters(page).getByText("All")).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(
    main(page).getByRole("link", { name: "1588 Armada Ballad" })
  ).toBeVisible();
  await checkpoint(page, "index", { viewportOnly: true });
});

test("a letter lists its pieces, and an empty letter is not a link", async ({
  page,
}) => {
  await open(page, "/pieces");
  await expect(letters(page).getByRole("link", { name: "Q" })).toHaveCount(0);
  await expect(letters(page).getByText("Q", { exact: true })).toHaveAttribute(
    "aria-disabled",
    "true"
  );
  await letters(page).getByRole("link", { name: "T" }).click();
  await expect(page).toHaveURL(/\/pieces\?letter=T$/);
  await expect(
    main(page).getByRole("heading", { level: 2, name: "Pieces under T" })
  ).toBeVisible();
  await expect(letters(page).getByText("T", { exact: true })).toHaveAttribute(
    "aria-current",
    "page"
  );
  const results = main(page).getByRole("region", { name: "Pieces under T" });
  await expect(results.getByRole("link")).toHaveCount(5);
  await expect(
    results.getByRole("link", { name: "Þorvald’s Lament" })
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Showing 5 pieces");
  // The chip takes the letter off again.
  await main(page).getByRole("link", { name: "Remove Letter: T" }).click();
  await expect(page).toHaveURL(/\/pieces$/);
});

test("the pages go on to page 2 and back", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, "/pieces");
  const pagination = main(page).getByRole("navigation", {
    name: "Pagination",
  });
  await pagination.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL(/\/pieces\?page=2$/);
  await expect(pagination.locator("[aria-current=page]")).toHaveText("Page 2");
  await pagination.getByRole("link", { name: "Previous" }).click();
  await expect(page).toHaveURL(/\/pieces$/);
});

test("a page past the end goes to the last page, and a messy URL to its canonical form", async ({
  page,
}) => {
  await page.goto("/pieces?page=99");
  await expect(page).toHaveURL(/\/pieces\?page=5$/);
  await page.goto("/pieces?letter=t&utm_source=mail");
  await expect(page).toHaveURL(/\/pieces\?letter=T$/);
  // Order alone isn't redirected, and the canonical link names the order.
  const response = await page.goto("/pieces?letter=T&q=lament");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\?letter=T&q=lament$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/pieces\?q=lament&letter=T$/
  );
});

test("the search box searches every letter, straight to the canonical URL", async ({
  page,
}) => {
  await open(page, "/pieces?letter=W");
  const requests: string[] = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/pieces")) requests.push(url.search);
  });
  await main(page)
    .getByRole("searchbox", { name: "Search pieces" })
    .fill("  kettle ");
  await main(page).getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/pieces\?q=kettle$/);
  await expect(
    main(page).getByRole("heading", { level: 2, name: "Results for ‘kettle’" })
  ).toBeVisible();
  await expect(
    main(page).getByRole("link", { name: "The Copper Kettle" })
  ).toBeVisible();
  // One data request, never the raw form and a 301.
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatch(/^\?q=kettle(&|$)/);
  await expect(
    main(page).getByRole("combobox", { name: "Sort by" })
  ).toHaveValue("relevance");
});

test("checkpoint: no-results, a search that matches nothing", async ({
  page,
}) => {
  await open(page, "/pieces?q=zzqx-nothing");
  await expect(
    main(page).getByRole("heading", { name: "Nothing matches ‘zzqx-nothing’" })
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("No results");
  await expect(
    main(page).getByRole("link", { name: "Browse pieces" })
  ).toHaveAttribute("href", "/pieces");
  await checkpoint(page, "no-results");
});

test("a search too slow keeps the search box and offers Try again", async ({
  page,
  request,
}) => {
  const q = `slow-${test.info().workerIndex}-${Date.now()}`;
  await failNext(request, {
    operationId: "listPieces",
    status: 500,
    code: "internal",
    match: { q },
  });
  await open(page, `/pieces?q=${q}`, 500);
  await expect(page).toHaveTitle("That search took too long · Bardic Torch");
  await expect(
    main(page).getByRole("heading", {
      level: 1,
      name: "That search took too long",
    })
  ).toBeVisible();
  await expect(
    main(page).getByRole("searchbox", { name: "Search pieces" })
  ).toHaveValue(q);
  // The failure was for one request: Try again gets the (empty) results.
  await main(page).getByRole("button", { name: "Try again" }).click();
  await expect(
    main(page).getByRole("heading", { name: `Nothing matches ‘${q}’` })
  ).toBeVisible();
});
