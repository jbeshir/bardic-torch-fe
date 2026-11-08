import { expect, type Page } from "@playwright/test";
import { waitForHydration } from "../support/hydration";
import { checkpoint } from "../support/journey";
import { test } from "../support/test";

/**
 * The History views and the revision page (plan §4.11) against the fixture
 * catalogue: each of the five entity types has an import revision (no
 * author, no base) and a user revision based on it (1001–1014). The
 * piece's and the bard's History views sit under track B's layouts.
 */

test.describe.configure({ mode: "parallel" });

const main = (page: Page) => page.getByRole("main");

async function open(page: Page, path: string, status = 200) {
  const response = await page.goto(path);
  expect(response?.status(), `GET ${path}`).toBe(status);
  await waitForHydration(page);
}

test("checkpoint: piece-history, from the piece's History tab", async ({
  page,
}) => {
  await open(page, "/pieces/the-copper-kettle");
  await main(page)
    .getByRole("navigation", { name: "Page views" })
    .getByRole("link", { name: "History" })
    .click();
  await expect(page).toHaveURL(/\/pieces\/the-copper-kettle\/history$/);
  await expect(page).toHaveTitle("History of The Copper Kettle · Bardic Torch");
  await expect(
    main(page).getByRole("heading", { level: 1, name: "The Copper Kettle" })
  ).toBeVisible();
  await expect(main(page)).toContainText("4 revisions");
  await expect(main(page)).toContainText(
    "Imported from the original wiki, by Archivist and Lorekeeper"
  );
  await checkpoint(page, "piece-history");
});

test("every other entity's History tab lists its revisions", async ({
  page,
}) => {
  for (const [path, newest] of [
    ["/bards/wren-of-the-vale/history", 1007],
    ["/categories/war/history", 1009],
    ["/collections/12/history", 1011],
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

test("a no-page bard has no History tab, but their history's address works", async ({
  page,
}) => {
  await open(page, "/bards/hollis-fenn");
  await expect(main(page).getByRole("link", { name: "History" })).toHaveCount(
    0
  );
  await open(page, "/bards/hollis-fenn/history");
  await expect(
    main(page).getByRole("heading", { level: 1, name: "Hollis Fenn" })
  ).toBeVisible();
  await expect(
    main(page).getByRole("heading", { level: 2, name: "History", exact: true })
  ).toBeVisible();
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

test("history: piece → History tab → newest row → its changes → Previous revision → the first version", async ({
  page,
}) => {
  await open(page, "/pieces/the-copper-kettle");
  await main(page)
    .getByRole("navigation", { name: "Page views" })
    .getByRole("link", { name: "History" })
    .click();
  await main(page)
    .getByRole("table", { name: "Revisions" })
    .getByRole("link", { name: /^View changes/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/revisions\/1014$/);
  await expect(
    main(page).getByRole("heading", {
      level: 1,
      name: "Revision 1014 of The Copper Kettle",
    })
  ).toBeVisible();
  await expect(
    main(page).getByRole("heading", { level: 2, name: "Changes" })
  ).toBeVisible();
  // Back through 1004 and 1003 to the import, which has no base.
  for (const older of [1004, 1003, 1001]) {
    await main(page).getByRole("link", { name: "Previous revision" }).click();
    await expect(page).toHaveURL(new RegExp(`/revisions/${older}$`));
  }
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
    main(page).getByRole("link", { name: "Previous revision" })
  ).toHaveCount(0);
  await main(page)
    .getByRole("link", { name: "View the piece as it is now" })
    .click();
  await expect(page).toHaveURL(/\/pieces\/the-copper-kettle$/);
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
