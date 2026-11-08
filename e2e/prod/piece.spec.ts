import { expect, type Page } from "@playwright/test";
import { waitForHydration } from "../support/hydration";
import { checkpoint } from "../support/journey";
import { test } from "../support/test";

/**
 * A piece's page (plan §4.5), against the fixture catalogue: The Copper
 * Kettle has every infobox row; The Long Road North has 15 categories;
 * The Unfinished Lay is a stub. The journey stops at the piece page (the
 * cross-entity one is C11.1's).
 */

test.describe.configure({ mode: "parallel" });

const main = (page: Page) => page.getByRole("main");
const infobox = (page: Page) =>
  main(page).getByRole("complementary", { name: "About this piece" });

async function open(page: Page, path: string, status = 200) {
  const response = await page.goto(path);
  expect(response?.status(), `GET ${path}`).toBe(status);
  await waitForHydration(page);
}

test("checkpoint: full, a piece opened from the A–Z with its infobox", async ({
  page,
}) => {
  await open(page, "/pieces?letter=C");
  await main(page).getByRole("link", { name: "The Copper Kettle" }).click();
  await expect(page).toHaveURL(/\/pieces\/the-copper-kettle$/);
  await expect(page).toHaveTitle("The Copper Kettle · Bardic Torch");
  await expect(
    main(page).getByRole("heading", { level: 1, name: "The Copper Kettle" })
  ).toBeVisible();
  await expect(main(page)).toContainText("Song · Dance music · 1650–1750");
  await expect(
    infobox(page).getByRole("link", { name: "Wren of the Vale" })
  ).toHaveAttribute("href", "/bards/wren-of-the-vale");
  await expect(infobox(page)).toContainText("(probably)");
  await expect(
    infobox(page).getByRole("link", { name: "Conservation status: Endangered" })
  ).toBeVisible();
  await expect(
    main(page)
      .getByRole("navigation", { name: "Page views" })
      .getByRole("link", { name: "History" })
  ).toHaveAttribute("href", "/pieces/the-copper-kettle/history");
  await checkpoint(page, "full");
});

test("journey: from the A–Z to a piece's links, licensing and history", async ({
  page,
}) => {
  await open(page, "/pieces?letter=C");
  await main(page).getByRole("link", { name: "The Copper Kettle" }).click();
  await expect(page).toHaveURL(/\/pieces\/the-copper-kettle$/);
  await waitForHydration(page);
  // The infobox's facts, then its Licensing row to the card.
  await expect(infobox(page)).toContainText("Song");
  await infobox(page).getByRole("link", { name: "Known" }).click();
  await expect(page).toHaveURL(/#licensing$/);
  await expect(
    main(page).getByRole("heading", { level: 2, name: "Licensing" })
  ).toBeInViewport();
  // The contents to Where to find it: a link with three roles is listed
  // under each, and every reader's URL is nofollow ugc.
  await main(page)
    .getByRole("navigation", { name: "Contents" })
    .getByRole("link", { name: "Where to find it" })
    .click();
  await expect(page).toHaveURL(/#where-to-find-it$/);
  const chords = main(page).getByRole("link", {
    name: "The Copper Kettle, with chords (external link)",
  });
  await expect(chords).toHaveCount(3);
  for (const rel of await main(page)
    .locator('section[aria-labelledby="where-to-find-it"] a[href^="http"]')
    .evaluateAll(anchors => anchors.map(a => a.getAttribute("rel")))) {
    expect(rel).toContain("nofollow ugc noopener");
  }
  await expect(
    main(page).getByRole("link", { name: "The Northmarch Songbook" }).first()
  ).toHaveAttribute("href", /^\/collections\/\d+$/);
  await expect(main(page).getByText("This link may be broken")).toBeVisible();
  // The History tab is there (its page is C8.1's).
  await expect(
    main(page)
      .getByRole("navigation", { name: "Page views" })
      .getByRole("link", { name: "History" })
  ).toHaveAttribute("href", "/pieces/the-copper-kettle/history");
});

test("checkpoint: stub, with its banner", async ({ page }) => {
  await open(page, "/pieces/the-unfinished-lay");
  await expect(main(page).getByText("This page is a stub.")).toBeVisible();
  await expect(
    main(page).getByRole("link", { name: "How to contribute" })
  ).toHaveAttribute("href", "/help/contributing");
  await checkpoint(page, "stub");
});

test("checkpoint: restricted, its links inside one closed disclosure", async ({
  page,
}) => {
  await open(page, "/pieces/the-dragons-hoard");
  await expect(
    main(page).getByText(
      "The creator has asked that this work isn’t recorded or shared."
    )
  ).toBeVisible();
  await expect(
    main(page).getByRole("heading", {
      level: 2,
      name: "Where it has been recorded",
    })
  ).toBeVisible();
  const restricted = main(page).locator(
    'a[href*="private-recordings.example"]'
  );
  await expect(restricted.first()).toBeHidden();
  // Every anchor to the work's host is inside the one closed disclosure.
  const outside = main(page).locator(
    'a[href*="private-recordings.example"]:not(details a)'
  );
  await expect(outside).toHaveCount(0);
  await expect(
    main(page).locator('a[href*="web-archive.example"]')
  ).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow"
  );
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(
    0
  );
  await checkpoint(page, "restricted");
});

test("opens a restricted piece's links on request, saying why first", async ({
  page,
}) => {
  await open(page, "/pieces/the-dragons-hoard");
  const summary = main(page).getByText(
    "Show links (the creator asks that this isn’t shared further)"
  );
  await summary.focus();
  await page.keyboard.press("Enter");
  const details = main(page).locator("details", { has: summary });
  await expect(details).toHaveAttribute("open", "");
  await expect(details.locator("p").first()).toHaveText(
    "The creator has asked that this work isn’t recorded or shared. These links are listed for reference only; please don’t repost them."
  );
  await expect(
    details.getByRole("link", { name: "The text of the poem (external link)" })
  ).toBeVisible();
  await expect(details.getByText("This link may be broken")).toBeVisible();
  await expect(
    details.getByRole("link", { name: /Archived copy/ })
  ).toHaveCount(0);
});

test("shows 12 of 15 categories, and the rest on request", async ({ page }) => {
  await open(page, "/pieces/the-long-road-north");
  const categories = main(page).getByRole("navigation", {
    name: "Categories",
  });
  await expect(categories.getByRole("link")).toHaveCount(12);
  const more = categories.getByRole("button", { name: "Show all 15" });
  await more.focus();
  await page.keyboard.press("Enter");
  await expect(categories.getByRole("link")).toHaveCount(15);
  await expect(more).toHaveAttribute("aria-expanded", "true");
  await expect(more).toBeFocused();
});

test("drops a credit to someone who asked not to have a page, and never says “unknown author”", async ({
  page,
}) => {
  await open(page, "/pieces/the-ashdown-wassail");
  await expect(infobox(page)).toContainText("Traditional");
  await expect(infobox(page)).not.toContainText("Hollis");
  await expect(main(page)).not.toContainText(/unknown author/i);
});

test("answers a slug that can't be one with our own 404", async ({ page }) => {
  await open(page, "/pieces/Not-A-Slug", 404);
  await expect(page).toHaveTitle("We couldn’t find that piece · Bardic Torch");
  await expect(
    main(page).getByRole("heading", {
      level: 1,
      name: "We couldn’t find that piece",
    })
  ).toBeVisible();
});
