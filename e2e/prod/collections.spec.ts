import { expect, type Page } from "@playwright/test";
import { waitForHydration } from "../support/hydration";
import { checkpoint } from "../support/journey";
import { test } from "../support/test";

/**
 * `/collections` and a collection's page (plan §4.9) against the fixture
 * catalogue: 14 collections on one page, the A–Z and the kind filter, The
 * Northmarch Songbook (a region, a part collection, a restricted piece's
 * citation) and The Drill Book (205 citations, capped at 200).
 */

test.describe.configure({ mode: "parallel" });

const main = (page: Page) => page.getByRole("main");

async function open(page: Page, path: string, status = 200) {
  const response = await page.goto(path);
  expect(response?.status(), `GET ${path}`).toBe(status);
  await waitForHydration(page);
}

test("checkpoint: the directory, every collection by sort name", async ({
  page,
}) => {
  await open(page, "/collections");
  await expect(page).toHaveTitle("Collections · Bardic Torch");
  await expect(main(page)).toContainText("14 collections");
  const results = main(page).getByRole("region", { name: "All collections" });
  // A leading "The" is ignored: "The Ashdown Tune Index" sorts under A.
  await expect(results.getByRole("listitem").nth(1)).toContainText(
    "The Ashdown Tune Index"
  );
  await checkpoint(page, "directory");
});

test("a letter and a kind narrow the list, straight to the canonical URL", async ({
  page,
}) => {
  await open(page, "/collections");
  await main(page)
    .getByRole("navigation", { name: "Collections by letter" })
    .getByRole("link", { name: "H", exact: true })
    .click();
  await expect(page).toHaveURL(/\/collections\?letter=H$/);
  await main(page).getByText("Filter by kind").click();
  await main(page).getByRole("checkbox", { name: "YouTube playlist" }).check();
  await main(page).getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(
    /\/collections\?kind=youtube_playlist&letter=H$/
  );
  await expect(
    main(page).getByRole("link", { name: "Harvest Playlist", exact: true })
  ).toBeVisible();
  await expect(
    main(page).getByRole("link", { name: "Hall Recordings" })
  ).toHaveCount(0);
  await main(page).getByRole("link", { name: "Clear all" }).click();
  await expect(page).toHaveURL(/\/collections$/);
});

test("checkpoint: collection, its infobox, parts and citations", async ({
  page,
}) => {
  await open(page, "/collections");
  await main(page)
    .getByRole("link", { name: "The Northmarch Songbook", exact: true })
    .click();
  await expect(page).toHaveURL(/\/collections\/12$/);
  await expect(main(page)).toContainText("Songbook website · Northmarch");
  await expect(
    main(page)
      .getByRole("region", { name: "Part collections" })
      .getByRole("link", { name: "2nd Northmarch Songbook" })
  ).toBeVisible();
  await expect(
    main(page).getByRole("link", { name: "The Copper Kettle" }).first()
  ).toBeVisible();
  await checkpoint(page, "collection");
});

test("a restricted piece's citation names it but links nowhere outside", async ({
  page,
}) => {
  await open(page, "/collections/12");
  await expect(
    main(page).getByRole("link", { name: "The Dragon’s Hoard" }).first()
  ).toHaveAttribute("href", "/pieces/the-dragons-hoard");
  await expect(
    main(page).getByText("Link not shown: see the piece page").first()
  ).toBeVisible();
  await expect(
    page.locator('a[href*="private-recordings.example"]')
  ).toHaveCount(0);
  expect(await page.content()).not.toContain("private-recordings.example");
});

test("a long list of citations says how many more there are", async ({
  page,
}) => {
  await open(page, "/collections/9");
  await expect(main(page).getByText("and 5 more")).toBeVisible();
});

test("an id that can't be one is a 404 without asking the API", async ({
  page,
}) => {
  for (const id of ["0", "012", "abc", "99999999999999999999"]) {
    await open(page, `/collections/${id}`, 404);
    await expect(
      main(page).getByRole("heading", {
        level: 1,
        name: "We couldn’t find that collection",
      })
    ).toBeVisible();
  }
});
