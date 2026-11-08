import { expect, type Page } from "@playwright/test";
import { waitForHydration } from "../support/hydration";
import { checkpoint } from "../support/journey";
import { test } from "../support/test";

/**
 * The History views and the revision page (plan §4.11) against the fixture
 * catalogue: each of the five entity types has an import revision (no
 * author, no base) and a user revision based on it (1001–1014).
 */

test.describe.configure({ mode: "parallel" });

const main = (page: Page) => page.getByRole("main");

async function open(page: Page, path: string, status = 200) {
  const response = await page.goto(path);
  expect(response?.status(), `GET ${path}`).toBe(status);
  await waitForHydration(page);
}

test("checkpoint: collection-history, from the collection's History tab", async ({
  page,
}) => {
  await open(page, "/collections/12");
  await main(page)
    .getByRole("navigation", { name: "Page views" })
    .getByRole("link", { name: "History" })
    .click();
  await expect(page).toHaveURL(/\/collections\/12\/history$/);
  await expect(page).toHaveTitle(
    "History of The Northmarch Songbook · Bardic Torch"
  );
  await expect(main(page)).toContainText("2 revisions");
  await expect(main(page)).toContainText(
    "Imported from the original wiki, by Archivist and Lorekeeper"
  );
  await checkpoint(page, "collection-history");
});

test("every History tab of track C's pages lists its revisions", async ({
  page,
}) => {
  for (const [path, newest] of [
    ["/categories/war/history", 1009],
    ["/events/midwinter-revel/history", 1013],
  ] as const) {
    await open(page, path);
    await expect(
      main(page).getByRole("link", {
        name: new RegExp(`^View changes ?, revision ${newest}$`),
      })
    ).toBeVisible();
  }
  // A page past the end goes back to the history with one 302.
  await page.goto("/categories/war/history?page=4");
  await expect(page).toHaveURL(/\/categories\/war\/history$/);
});

test("checkpoint: revision, a piece's changes against its base", async ({
  page,
}) => {
  await open(page, "/revisions/1003");
  await expect(page).toHaveTitle(
    "Revision 1003 of The Copper Kettle · Bardic Torch"
  );
  await expect(
    main(page).getByText("This is how the revision looks today.")
  ).toBeVisible();
  await expect(
    main(page).getByRole("heading", { level: 2, name: "Changes" })
  ).toBeVisible();
  await expect(
    main(page).getByRole("heading", { level: 3, name: "Credits" })
  ).toBeVisible();
  await checkpoint(page, "revision");
});

test("history: History tab → newest row → its changes → Older revision → the first version", async ({
  page,
}) => {
  await open(page, "/collections/12/history");
  await main(page)
    .getByRole("table", { name: "Revisions" })
    .getByRole("link", { name: /^View changes/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/revisions\/1011$/);
  await expect(
    main(page).getByRole("heading", {
      level: 1,
      name: "Revision 1011 of The Northmarch Songbook",
    })
  ).toBeVisible();
  await main(page).getByRole("link", { name: "Older revision" }).click();
  await expect(page).toHaveURL(/\/revisions\/1010$/);
  await expect(
    main(page).getByRole("heading", {
      level: 2,
      name: "First recorded version",
    })
  ).toBeVisible();
  await expect(
    main(page).getByText("This is how the revision looks today.")
  ).toBeVisible();
  await expect(
    main(page).getByRole("link", { name: "Older revision" })
  ).toHaveCount(0);
  await main(page)
    .getByRole("link", { name: "View the collection as it is now" })
    .click();
  await expect(page).toHaveURL(/\/collections\/12$/);
});

test("a person's first version and a restricted piece's revision link nowhere they shouldn't", async ({
  page,
}) => {
  await open(page, "/revisions/1006");
  await expect(
    main(page).getByRole("heading", {
      level: 2,
      name: "First recorded version",
    })
  ).toBeVisible();
  await open(page, "/revisions/1005");
  await expect(main(page)).toContainText("its links are shown as text only");
  await expect(
    main(page).locator('a[href^="http"]:not([href*="creativecommons.org"])')
  ).toHaveCount(0);
  // An id that can't be one is a 404 without asking the API.
  await open(page, "/revisions/007", 404);
});
