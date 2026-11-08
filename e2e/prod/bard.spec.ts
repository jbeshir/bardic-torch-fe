import { expect, type Page } from "@playwright/test";
import { waitForHydration } from "../support/hydration";
import { checkpoint } from "../support/journey";
import { test } from "../support/test";

/**
 * A bard's page (plan §4.6), against the fixture catalogue: Wren of the
 * Vale has a full profile; Hollis Fenn asked not to have a page; Brannoc
 * the Drillmaster has 205 works, 5 more than the API lists. The journey
 * goes from the bard to one of their works (the piece → bard leg is
 * C11.1's cross-entity journey).
 */

test.describe.configure({ mode: "parallel" });

const main = (page: Page) => page.getByRole("main");

async function open(page: Page, path: string, status = 200) {
  const response = await page.goto(path);
  expect(response?.status(), `GET ${path}`).toBe(status);
  await waitForHydration(page);
}

test("checkpoint: profile, a bard with works, performances and links", async ({
  page,
}) => {
  await open(page, "/bards/wren-of-the-vale");
  await expect(page).toHaveTitle("Wren of the Vale · Bardic Torch");
  await expect(main(page)).toContainText("Community bard · she/her");
  const infobox = main(page).getByRole("complementary", {
    name: "About this bard",
  });
  await expect(infobox).toContainText("Singer, Songwriter, Storyteller");
  await expect(
    infobox.getByRole("link", { name: "Barony of Ashdown" })
  ).toBeVisible();
  await expect(
    main(page).getByRole("heading", { level: 2, name: "Works" })
  ).toBeVisible();
  await checkpoint(page, "profile");
});

test("checkpoint: no-page, the identity only", async ({ page }) => {
  await open(page, "/bards/hollis-fenn");
  await expect(
    main(page).getByText("Hollis Fenn has asked not to have a page here.")
  ).toBeVisible();
  await expect(main(page).getByRole("link", { name: "History" })).toHaveCount(
    0
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow"
  );
  await checkpoint(page, "no-page");
});

test("journey: from the bard's works to a piece", async ({ page }) => {
  await open(page, "/bards/wren-of-the-vale");
  const works = main(page).getByRole("region", { name: "Works" });
  await expect(
    works.getByRole("heading", { level: 3, name: "Tunes (1)" })
  ).toBeVisible();
  await works.getByRole("link", { name: "The Copper Kettle" }).click();
  await expect(page).toHaveURL(/\/pieces\/the-copper-kettle$/);
  await expect(
    main(page).getByRole("heading", { level: 1, name: "The Copper Kettle" })
  ).toBeVisible();
});

test("names a restricted piece's performance without linking its recording", async ({
  page,
}) => {
  await open(page, "/bards/wren-of-the-vale");
  const performances = main(page).getByRole("region", {
    name: "Performances",
  });
  await expect(
    performances.getByRole("link", { name: "The Dragon’s Hoard" }).first()
  ).toHaveAttribute("href", "/pieces/the-dragons-hoard");
  await expect(
    performances.getByText("Link not shown: see the piece page").first()
  ).toBeVisible();
  await expect(
    main(page).locator('a[href*="private-recordings.example"]')
  ).toHaveCount(0);
});

test("says how many works aren't listed past the API's 200", async ({
  page,
}) => {
  await open(page, "/bards/brannoc-the-drillmaster");
  await expect(
    main(page)
      .getByRole("region", { name: "Works" })
      .getByText("and 5 more not listed here")
  ).toBeVisible();
});

test("says a group disbanded", async ({ page }) => {
  await open(page, "/bards/the-greywater-minstrels");
  await expect(main(page)).toContainText("Group · Disbanded 1 Sep 2019");
});
