import { expect, type Page } from "@playwright/test";
import { waitForHydration } from "../support/hydration";
import { checkpoint } from "../support/journey";
import { appBar } from "../support/shell";
import { test } from "../support/test";

/**
 * `/search?q=`, the catalogue-wide search (plan §4.4), from the header's
 * search at 1280 and the app bar's search sheet at 360, against the
 * fixture catalogue: "northmarch" finds a piece, a bard and a category;
 * "drill" finds 205 pieces, more than the page shows.
 */

test.describe.configure({ mode: "parallel" });

const main = (page: Page) => page.getByRole("main");

test("checkpoint: results, the pieces, bards and categories of a search", async ({
  page,
}) => {
  const response = await page.goto("/search?q=northmarch");
  expect(response?.status()).toBe(200);
  await waitForHydration(page);
  await expect(page).toHaveTitle("Search: northmarch · Bardic Torch");
  await expect(
    main(page).getByRole("searchbox", { name: "Search the catalogue" })
  ).toHaveValue("northmarch");
  await expect(
    main(page)
      .getByRole("region", { name: "Pieces" })
      .getByRole("link", { name: "Northmarch Rising" })
  ).toBeVisible();
  await expect(
    main(page)
      .getByRole("region", { name: "Bards" })
      .getByRole("link", { name: "Northmarch Bards" })
  ).toBeVisible();
  await expect(
    main(page)
      .getByRole("region", { name: "Categories" })
      .getByRole("link", { name: /Northmarch/ })
  ).toHaveAttribute("href", "/categories/northmarch");
  await expect(main(page).getByRole("status")).toHaveText(
    /^1 piece, 1 bard and \d+ categor(y|ies) match ‘northmarch’$/
  );
  await checkpoint(page, "results");
});

test("at 1280 the header search lands on the results, and See all on the pieces", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/help");
  await waitForHydration(page);
  const header = page.getByRole("banner");
  await header
    .getByRole("searchbox", { name: "Search the catalogue" })
    .fill("  drill ");
  await header.getByRole("button", { name: "Search", exact: true }).click();
  // Straight to the canonical URL, the search trimmed.
  await expect(page).toHaveURL(/\/search\?q=drill$/);
  await expect(
    main(page).getByRole("heading", { level: 1, name: "Search" })
  ).toBeVisible();
  await main(page).getByRole("link", { name: "See all 205 pieces" }).click();
  await expect(page).toHaveURL(/\/pieces\?q=drill$/);
  await expect(
    main(page).getByRole("heading", { level: 2, name: "Results for ‘drill’" })
  ).toBeVisible();
});

test("at 360 the app bar's search sheet lands on the results and closes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await waitForHydration(page);
  const search = appBar(page).getByRole("button", {
    name: "Search",
    exact: true,
  });
  await search.click();
  const field = appBar(page).getByRole("searchbox", {
    name: "Search the catalogue",
  });
  await expect(field).toBeFocused();
  await field.fill("northmarch");
  await field.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=northmarch$/);
  await expect(field).toBeHidden();
  await expect(search).toHaveAttribute("aria-expanded", "false");
  await expect(
    main(page).getByRole("link", { name: "Northmarch Rising" })
  ).toBeVisible();
});

test("an empty search says what to type, and a search for nothing says so", async ({
  page,
}) => {
  await page.goto("/search");
  await expect(main(page)).toContainText(
    "Type a word from a title, a name or a category."
  );
  await page.goto("/search?q=zzqx-nothing");
  await expect(
    main(page).getByRole("heading", { name: "Nothing matches ‘zzqx-nothing’" })
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, follow"
  );
});
