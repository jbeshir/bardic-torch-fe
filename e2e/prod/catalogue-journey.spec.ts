import { expect, type Page } from "@playwright/test";
import { waitForHydration } from "../support/hydration";
import { test } from "../support/test";

/**
 * The one cross-entity journey (plan C11.1), through the catalogue the way a
 * reader would: the piece browse to The Copper Kettle, its credit to Wren of
 * the Vale, her affiliation's category, back (twice) to the piece, the
 * songbook it is in, back to the piece again, a performance's event, and
 * the event. Every page along the way has one h1 and the Back button works
 * between them.
 */

test.use({ viewport: { width: 1280, height: 800 } });

const main = (page: Page) => page.getByRole("main");

async function expectPage(page: Page, url: RegExp, heading: string) {
  await expect(page).toHaveURL(url);
  await expect(
    main(page).getByRole("heading", { level: 1, name: heading, exact: true })
  ).toBeVisible();
  await expect(main(page).getByRole("heading", { level: 1 })).toHaveCount(1);
}

test("journey: pieces → piece → bard → category → piece → collection → piece → event", async ({
  page,
}) => {
  // The piece browse, and The Copper Kettle from its C page.
  const response = await page.goto("/pieces");
  expect(response?.status()).toBe(200);
  await waitForHydration(page);
  await main(page)
    .getByRole("navigation", { name: "Pieces by letter" })
    .getByRole("link", { name: "C", exact: true })
    .click();
  await expect(page).toHaveURL(/\/pieces\?letter=C$/);
  await main(page)
    .getByRole("link", { name: "The Copper Kettle", exact: true })
    .click();
  await expectPage(page, /\/pieces\/the-copper-kettle$/, "The Copper Kettle");

  // Its credit to the bard.
  await main(page)
    .getByRole("complementary", { name: "About this piece" })
    .getByRole("link", { name: "Wren of the Vale", exact: true })
    .click();
  await expectPage(page, /\/bards\/wren-of-the-vale$/, "Wren of the Vale");

  // The bard's affiliation, as the category it is.
  await main(page)
    .getByRole("complementary", { name: "About this bard" })
    .getByRole("link", { name: "Barony of Ashdown", exact: true })
    .click();
  await expectPage(page, /\/categories\/[a-z-]+$/, "Barony of Ashdown");
  await expect(main(page)).toContainText("Affiliation");

  // Back through the bard to the piece.
  await page.goBack();
  await expect(page).toHaveURL(/\/bards\/wren-of-the-vale$/);
  await page.goBack();
  await expectPage(page, /\/pieces\/the-copper-kettle$/, "The Copper Kettle");

  // The songbook the piece's chords are in.
  await main(page)
    .getByRole("link", { name: "The Northmarch Songbook", exact: true })
    .first()
    .click();
  await expectPage(page, /\/collections\/12$/, "The Northmarch Songbook");
  await expect(
    main(page).getByRole("link", { name: "The Copper Kettle" }).first()
  ).toBeVisible();

  // Back to the piece, and on to the event of one of its performances.
  await page.goBack();
  await expectPage(page, /\/pieces\/the-copper-kettle$/, "The Copper Kettle");
  await main(page)
    .getByRole("link", { name: "The Copper Hearth", exact: true })
    .first()
    .click();
  await expectPage(page, /\/events\/the-copper-hearth$/, "The Copper Hearth");
  await expect(
    main(page).getByRole("region", { name: "Performances recorded here" })
  ).toContainText("The Copper Kettle");
});
