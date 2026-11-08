import { expect, type Page } from "@playwright/test";
import { failNext } from "../support/fixture-api";
import { waitForHydration } from "../support/hydration";
import {
  expectNoHorizontalOverflow,
  expectNoLayoutShift,
  expectPrimaryTargetsAtLeast44,
  expectTargetSizesAtLeast24,
} from "../support/layout";
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
  await letters(page).getByRole("link", { name: "T", exact: true }).click();
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
  await expect(main(page).getByRole("status")).toHaveText("Showing 5 pieces");
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
  ).toHaveValue("");
});

test("checkpoint: no-results, a search that matches nothing", async ({
  page,
}) => {
  await open(page, "/pieces?q=zzqx-nothing");
  await expect(
    main(page).getByRole("heading", { name: "Nothing matches ‘zzqx-nothing’" })
  ).toBeVisible();
  await expect(main(page).getByRole("status")).toHaveText("No results");
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

// ---------------------------------------------------------------------------
// C2.2: the facet column, its chips and stale categories

const filters = (page: Page) =>
  main(page).getByRole("region", { name: "Filters" });

test("at 1280 the facet column applies each tick at once, and its chips take them off", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, "/pieces");
  // The column sits beside the results: left of them, at their top.
  const column = await filters(page).boundingBox();
  const results = await main(page)
    .getByRole("region", { name: "All pieces" })
    .boundingBox();
  expect(column && results && column.x < results.x).toBe(true);

  await filters(page)
    .getByRole("checkbox", { name: /^Warlike\b/ })
    .check();
  await expect(page).toHaveURL(/\/pieces\?term=warlike$/);
  await expect(main(page).getByRole("status")).toHaveText("Showing 3 pieces");
  // Focus stays on the box the form was rebuilt with.
  await expect(
    filters(page).getByRole("checkbox", { name: /^Warlike\b/ })
  ).toBeFocused();
  await expect(
    filters(page).getByRole("checkbox", { name: "Song, 3 pieces" })
  ).toBeVisible();
  await filters(page)
    .getByRole("checkbox", { name: /^Song\b/ })
    .press("Space");
  await expect(page).toHaveURL(/\/pieces\?term=warlike&kind=song$/);
  const chips = main(page).getByRole("region", { name: "Selected filters" });
  await expect(
    chips.getByRole("link", { name: "Remove Mood: Warlike" })
  ).toBeVisible();
  await expect(
    chips.getByRole("link", { name: "Remove Kind: Song" })
  ).toBeVisible();

  await chips.getByRole("link", { name: "Remove Mood: Warlike" }).click();
  await expect(page).toHaveURL(/\/pieces\?kind=song$/);
  await expect(
    filters(page).getByRole("checkbox", { name: /^Warlike\b/ })
  ).not.toBeChecked();
  await expect(main(page).getByRole("status")).toHaveText("Showing 229 pieces");
  await main(page)
    .getByRole("navigation", { name: "Pagination" })
    .getByRole("link", { name: "Next" })
    .click();
  await expect(page).toHaveURL(/\/pieces\?kind=song&page=2$/);
});

test("checkpoint: filtered, a kind and a mood", async ({ page }) => {
  await open(page, "/pieces?kind=poem&term=eerie");
  await expect(main(page).getByRole("status")).toHaveText("Showing 3 pieces");
  await expect(
    main(page).getByRole("link", { name: "Remove Kind: Poem" })
  ).toBeVisible();
  await expect(
    main(page).getByRole("link", { name: "Remove Mood: Eerie" })
  ).toBeVisible();
  await checkpoint(page, "filtered");
});

test("a link with a category that no longer exists leaves it out and says so", async ({
  page,
}) => {
  await open(page, "/pieces?term=eerie&term=no-such-mood");
  await expect(page).toHaveURL(/\?term=eerie&term=no-such-mood$/);
  await expect(main(page)).toContainText(
    "Some categories in this link no longer exist, so we left them out: ‘no-such-mood’."
  );
  await expect(
    main(page).getByRole("link", { name: "Remove Mood: Eerie" })
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, follow"
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/pieces\?term=eerie&term=no-such-mood$/
  );
});

test("at 1024 the list and its filters reflow without scrolling sideways", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await open(page, "/pieces");
  await expectNoHorizontalOverflow(page);
  // Below xl the filters are in the drawer the Filters button opens.
  await expect(
    main(page).getByRole("button", { name: "Filters" })
  ).toBeVisible();
});

// ---------------------------------------------------------------------------
// C2.3: the facet drawer, below xl with JS

const MOBILE = { width: 360, height: 800 };

const drawer = (page: Page) =>
  page.getByRole("dialog", { name: "Filter pieces" });

/** Opens the drawer where there is one (below xl); from xl, the column shows. */
async function openDrawerBelowXl(page: Page) {
  const button = main(page).getByRole("button", { name: /^Filters/ });
  if (
    (page.viewportSize()?.width ?? 0) < 1280 &&
    !(await drawer(page).isVisible())
  ) {
    await button.click();
    await expect(drawer(page)).toBeVisible();
  }
}

test("at 360 the filters open in a drawer: tick two, Show results, and the chips show them", async ({
  page,
}) => {
  await page.setViewportSize(MOBILE);
  await open(page, "/pieces");
  // With JS the filters are the drawer's only: none left in the page.
  await expect(main(page).getByRole("region", { name: "Filters" })).toHaveCount(
    0
  );
  const trigger = main(page).getByRole("button", { name: "Filters" });
  await trigger.click();
  await expect(drawer(page)).toBeVisible();
  await expect(
    drawer(page).getByRole("button", { name: "Close filters" }).first()
  ).toBeFocused();
  await expectTargetSizesAtLeast24(page, [MOBILE.width]);
  await expectPrimaryTargetsAtLeast44([
    drawer(page).getByRole("button", { name: "Show results" }),
    drawer(page).getByRole("button", { name: "Close filters" }).first(),
    drawer(page).locator("label").first(),
  ]);

  await drawer(page)
    .getByRole("checkbox", { name: /^Poem\b/ })
    .check();
  await drawer(page)
    .getByRole("checkbox", { name: /^Eerie\b/ })
    .check();
  // Nothing applies until asked: no live count, no navigation.
  await expect(page).toHaveURL(/\/pieces$/);
  await drawer(page).getByRole("button", { name: "Show results" }).click();
  await expect(page).toHaveURL(/\/pieces\?term=eerie&kind=poem$/);
  await expect(drawer(page)).toBeHidden();
  await expect(
    main(page).getByRole("button", { name: "Filters (2 selected)" })
  ).toBeFocused();
  await expect(main(page).getByRole("status")).toHaveText("Showing 3 pieces");
  await expect(
    main(page).getByRole("link", { name: "Remove Kind: Poem" })
  ).toBeVisible();
  await expect(
    main(page).getByRole("link", { name: "Remove Mood: Eerie" })
  ).toBeVisible();
});

test("Escape closes the drawer and forgets its unapplied ticks", async ({
  page,
}) => {
  await page.setViewportSize(MOBILE);
  await open(page, "/pieces?letter=T");
  const trigger = main(page).getByRole("button", { name: "Filters" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(drawer(page)).toBeVisible();
  await drawer(page)
    .getByRole("checkbox", { name: /^Song\b/ })
    .check();
  await page.keyboard.press("Escape");
  await expect(drawer(page)).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL(/\/pieces\?letter=T$/);
  await trigger.click();
  await expect(
    drawer(page).getByRole("checkbox", { name: /^Song\b/ })
  ).not.toBeChecked();
});

test("hydration moves nothing at 360: the filters after the results give way to the drawer", async ({
  page,
}) => {
  await expectNoLayoutShift(page, "/pieces?kind=poem&term=eerie", MOBILE);
});

test("checkpoint: facet-drawer-open (the facet column at 1280)", async ({
  page,
}) => {
  await open(page, "/pieces?kind=poem");
  await checkpoint(page, "facet-drawer-open", {
    target: "dialog[open], #filters",
    atEachViewport: openDrawerBelowXl,
    viewportOnly: true,
  });
});
