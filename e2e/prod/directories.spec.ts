import { expect, type Page } from "@playwright/test";
import { waitForHydration } from "../support/hydration";
import { checkpoint } from "../support/journey";
import { test } from "../support/test";

/**
 * The directories (plan §4.7, §4.9, §4.10). Track B's part is `/bards`
 * (C5.2): the A–Z of persons and groups, its search and its filters,
 * against the fixture catalogue (W has 2 bards). Collections and events
 * join this journey with C7.
 */

test.describe.configure({ mode: "parallel" });

const main = (page: Page) => page.getByRole("main");

async function open(page: Page, path: string, status = 200) {
  const response = await page.goto(path);
  expect(response?.status(), `GET ${path}`).toBe(status);
  await waitForHydration(page);
}

test.describe("/bards", () => {
  test("checkpoint: bards, a letter of the directory", async ({ page }) => {
    await open(page, "/bards?letter=W");
    await expect(page).toHaveTitle("Bards under W · Bardic Torch");
    const results = main(page).getByRole("region", { name: "Bards under W" });
    await expect(results.getByRole("link")).toHaveCount(2);
    await expect(
      main(page)
        .getByRole("navigation", { name: "Bards by letter" })
        .getByText("W", { exact: true })
    ).toHaveAttribute("aria-current", "page");
    await checkpoint(page, "bards");
  });

  test("lists a person with no page as a stub, linking to their identity page", async ({
    page,
  }) => {
    await open(page, "/bards?letter=H");
    const row = main(page)
      .getByRole("listitem")
      .filter({ hasText: "Hollis Fenn" });
    await expect(row).toContainText("Stub");
    await row.getByRole("link", { name: "Hollis Fenn" }).click();
    await expect(page).toHaveURL(/\/bards\/hollis-fenn$/);
  });

  test("filters at xl as soon as a box is ticked, and the chip takes it off", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, "/bards");
    await main(page).getByRole("checkbox", { name: "Group" }).check();
    await expect(page).toHaveURL(/\/bards\?kind=group$/);
    await expect(
      main(page).getByRole("link", { name: "Northmarch Bards" })
    ).toBeVisible();
    await main(page).getByRole("link", { name: "Remove Kind: Group" }).click();
    await expect(page).toHaveURL(/\/bards$/);
    await expect(
      main(page).getByRole("checkbox", { name: "Group" })
    ).not.toBeChecked();
  });

  test("leaves out an affiliation that no longer exists, and says so", async ({
    page,
  }) => {
    await open(page, "/bards?affiliation=gone-kingdom");
    await expect(
      main(page).getByText(
        "That affiliation no longer exists, so we left it out."
      )
    ).toBeVisible();
  });

  test("says nothing matches a search", async ({ page }) => {
    await open(page, "/bards?q=zzzqqq");
    await expect(
      main(page).getByRole("heading", { name: "Nothing matches ‘zzzqqq’" })
    ).toBeVisible();
    await main(page).getByRole("link", { name: "Clear search" }).click();
    await expect(page).toHaveURL(/\/bards$/);
  });
});
