import { expect, type Page } from "@playwright/test";
import { waitForHydration } from "../support/hydration";
import { checkpoint } from "../support/journey";
import { test } from "../support/test";

/**
 * `/categories` and a category's page (plan §4.8) against the fixture
 * catalogue: the term tree by facet, one facet alone, the piece-field
 * sections, a term with ancestors and members, an affiliation's bards,
 * member paging and the breadcrumb collapse below sm.
 */

test.describe.configure({ mode: "parallel" });

const main = (page: Page) => page.getByRole("main");

async function open(page: Page, path: string, status = 200) {
  const response = await page.goto(path);
  expect(response?.status(), `GET ${path}`).toBe(status);
  await waitForHydration(page);
}

test("checkpoint: index, every facet's tree with its counts", async ({
  page,
}) => {
  await open(page, "/categories");
  await expect(page).toHaveTitle("Categories · Bardic Torch");
  await expect(
    main(page).getByRole("heading", { level: 1, name: "Categories" })
  ).toBeVisible();
  const topic = main(page).getByRole("region", { name: "Topic" });
  await expect(topic.getByRole("link", { name: "Swords" })).toBeVisible();
  await expect(
    main(page)
      .getByRole("region", { name: "Kind" })
      .getByRole("link", { name: "Song" })
  ).toHaveAttribute("href", "/pieces?kind=song");
  await checkpoint(page, "index", { viewportOnly: true });
});

test("a facet alone, from the section nav, and back by the breadcrumb", async ({
  page,
}) => {
  await open(page, "/categories");
  await main(page)
    .getByRole("navigation", { name: "Category sections" })
    .getByRole("link", { name: "Mood" })
    .click();
  await expect(page).toHaveURL(/\/categories\?facet=mood$/);
  await expect(
    main(page).getByRole("heading", { level: 1, name: "Mood" })
  ).toBeVisible();
  await expect(main(page).getByRole("link", { name: "Warlike" })).toBeVisible();
  await expect(main(page).getByRole("link", { name: "Swords" })).toHaveCount(0);
  await main(page)
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByRole("link", { name: "Categories" })
    .click();
  await expect(page).toHaveURL(/\/categories$/);
  // An invalid facet is dropped with one 301.
  await page.goto("/categories?facet=genre");
  await expect(page).toHaveURL(/\/categories$/);
});

test("checkpoint: term, a category with its ancestors and members", async ({
  page,
}) => {
  await open(page, "/categories/swords");
  await expect(page).toHaveTitle("Swords · Bardic Torch");
  await expect(main(page)).toContainText("Topic · 2 pieces");
  const crumbs = main(page).getByRole("navigation", { name: "Breadcrumb" });
  await expect(crumbs.getByRole("link", { name: "Battles" })).toHaveAttribute(
    "href",
    "/categories/battles"
  );
  const members = main(page).getByRole("region", { name: "Pieces" });
  await expect(
    members.getByRole("link", { name: "Fields of Thorn" })
  ).toBeVisible();
  await expect(
    main(page)
      .getByRole("navigation", { name: "Categories" })
      .getByRole("link", { name: "Topic: Swords" })
  ).toHaveAttribute("aria-current", "page");
  await checkpoint(page, "term");
});

test("from the tree to a term, then its parent by the infobox", async ({
  page,
}) => {
  await open(page, "/categories");
  await main(page)
    .getByRole("region", { name: "Topic" })
    .getByRole("link", { name: "Swords" })
    .click();
  await expect(page).toHaveURL(/\/categories\/swords$/);
  await main(page)
    .getByRole("complementary", { name: "Swords" })
    .getByRole("link", { name: "Battles" })
    .click();
  await expect(
    main(page).getByRole("heading", { level: 1, name: "Battles" })
  ).toBeVisible();
  await expect(
    main(page).getByRole("link", { name: /^Swords \(/ })
  ).toBeVisible();
});

test("an affiliation lists its bards", async ({ page }) => {
  await open(page, "/categories/northmarch");
  await expect(main(page)).toContainText("Affiliation · 4 bards");
  const members = main(page).getByRole("region", { name: "Bards" });
  await expect(
    members.getByRole("link", { name: "Wren of the Vale" })
  ).toHaveAttribute("href", "/bards/wren-of-the-vale");
  await expect(
    members.getByRole("link", { name: "Search these bards" })
  ).toHaveAttribute("href", "/bards?affiliation=northmarch");
});

test("the members page on, reloading only the members", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, "/categories/joyful");
  const requests: string[] = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname.endsWith(".data")) requests.push(url.search);
  });
  await main(page)
    .getByRole("navigation", { name: "Pagination" })
    .getByRole("link", { name: "Next" })
    .click();
  await expect(page).toHaveURL(/\/categories\/joyful\?page=2$/);
  await expect(
    main(page).getByRole("heading", { level: 1, name: "Joyful" })
  ).toBeVisible();
  // One request, for the members' route alone: the head stays.
  expect(requests).toHaveLength(1);
  expect(requests[0]).toContain("_routes=routes%2Fcategories.%24slug._index");
  // Past the end, one 302 to the last page.
  await page.goto("/categories/joyful?page=99");
  await expect(page).toHaveURL(/\/categories\/joyful\?page=5$/);
});

test("an invalid slug is a 404 without asking the API", async ({ page }) => {
  await open(page, "/categories/Swords", 404);
  await expect(
    main(page).getByRole("heading", {
      level: 1,
      name: "We couldn’t find that category",
    })
  ).toBeVisible();
  await open(page, "/categories/a%2Fb", 404);
});

test.describe("below sm", () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test("the breadcrumb trail collapses, and opens to the first hidden crumb", async ({
    page,
  }) => {
    await open(page, "/categories/swords");
    const crumbs = main(page).getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs.getByRole("link", { name: "Topic" })).toBeHidden();
    const more = crumbs.getByRole("button", { name: "Show full path" });
    await more.click();
    await expect(crumbs.getByRole("link", { name: "Topic" })).toBeFocused();
    await expect(crumbs.getByRole("link", { name: "War" })).toBeVisible();
    await expect(more).toHaveCount(0);
  });
});
