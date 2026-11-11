import { expect } from "@playwright/test";
import { collectCspViolations } from "./support/csp";
import { waitForHydration } from "./support/hydration";
import { test } from "./support/test";

/** The read journeys and the stubbed sign-in, on the e2e build. */

const MOBILE = { width: 360, height: 800 };

test("home and search: landmarks, skip link, header search, See all", async ({
  page,
}) => {
  const violations = collectCspViolations(page);
  await page.goto("/");
  await waitForHydration(page);
  for (const role of ["banner", "main", "contentinfo"] as const) {
    await expect(page.getByRole(role)).toHaveCount(1);
  }
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  expect(violations).toEqual([]);

  const header = page.getByRole("banner");
  await header
    .getByRole("searchbox", { name: "Search the catalogue" })
    .fill("northmarch");
  await header.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\/search\?q=northmarch$/);
  const main = page.getByRole("main");
  await expect(
    main
      .getByRole("region", { name: "Pieces" })
      .getByRole("link", { name: "Northmarch Rising" })
  ).toBeVisible();
  await expect(
    main
      .getByRole("region", { name: "Bards" })
      .getByRole("link", { name: "Northmarch Bards" })
  ).toBeVisible();

  const box = main.getByRole("searchbox", { name: "Search the catalogue" });
  await box.fill("drill");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=drill$/);
  await main.getByRole("link", { name: "See all 205 pieces" }).click();
  await expect(page).toHaveURL(/\/pieces\?q=drill$/);
  await expect(
    main.getByRole("heading", { level: 2, name: "Results for ‘drill’" })
  ).toBeVisible();
});

test("browse pieces: letters, pages, filters applied at once, a stale term", async ({
  page,
}) => {
  await page.goto("/pieces");
  await waitForHydration(page);
  const main = page.getByRole("main");
  const pagination = main.getByRole("navigation", { name: "Pagination" });
  await pagination.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL(/\/pieces\?page=2$/);
  await expect(main.getByRole("status")).toHaveText(
    /^Showing 51–100 of \d[\d,]* pieces$/
  );
  await pagination.getByRole("link", { name: "Previous" }).click();
  await expect(page).toHaveURL(/\/pieces$/);

  await main
    .getByRole("navigation", { name: "Pieces by letter" })
    .getByRole("link", { name: "T", exact: true })
    .click();
  await expect(page).toHaveURL(/\/pieces\?letter=T$/);
  await expect(
    main
      .getByRole("region", { name: "Pieces under T" })
      .getByRole("link", { name: "Þorvald’s Lament" })
  ).toBeVisible();
  await main.getByRole("link", { name: "Remove Letter: T" }).click();
  await expect(page).toHaveURL(/\/pieces$/);

  const filters = main.getByRole("region", { name: "Filters", exact: true });
  await filters.getByRole("checkbox", { name: /^Poem\b/ }).check();
  await expect(page).toHaveURL(/\/pieces\?kind=poem$/);
  await filters.getByRole("checkbox", { name: /^Eerie\b/ }).check();
  await expect(page).toHaveURL(/term=eerie/);
  await expect(main.getByRole("status")).toHaveText("Showing 3 pieces");
  await main.getByRole("link", { name: "Remove Kind: Poem" }).click();
  await expect(page).not.toHaveURL(/kind=poem/);
  await expect(
    main.getByRole("link", { name: "Remove Mood: Eerie" })
  ).toBeVisible();

  await page.goto("/pieces?term=no-longer-a-term");
  await expect(main).toContainText("we left them out");
});

test.describe("filters on a phone", () => {
  test.use({ viewport: MOBILE });

  test("the drawer: Show results applies, Escape discards", async ({
    page,
  }) => {
    await page.goto("/pieces");
    await waitForHydration(page);
    const main = page.getByRole("main");
    const drawer = page.getByRole("dialog", { name: "Filter pieces" });
    const trigger = main.getByRole("button", { name: "Filters" });
    await trigger.click();
    await expect(
      drawer.getByRole("button", { name: "Close filters" }).first()
    ).toBeFocused();
    await drawer.getByRole("checkbox", { name: /^Poem\b/ }).check();
    await drawer.getByRole("checkbox", { name: /^Eerie\b/ }).check();
    await expect(page).toHaveURL(/\/pieces$/);
    await drawer.getByRole("button", { name: "Show results" }).click();
    await expect(page).toHaveURL(/\/pieces\?term=eerie&kind=poem$/);
    await expect(drawer).toBeHidden();
    await expect(
      main.getByRole("button", { name: "Filters (2 selected)" })
    ).toBeFocused();

    await page.goto("/pieces?letter=T");
    await waitForHydration(page);
    await trigger.click();
    await drawer.getByRole("checkbox", { name: /^Song\b/ }).check();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(page).toHaveURL(/\/pieces\?letter=T$/);
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the facet form and the letters are plain GET", async ({ page }) => {
    await page.goto("/pieces?letter=W");
    const main = page.getByRole("main");
    const filters = main.getByRole("region", { name: "Filters" });
    await filters.getByRole("checkbox", { name: /^Song\b/ }).check();
    await filters.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/kind=song/);
    await expect(
      main.getByRole("link", { name: "Remove Kind: Song" })
    ).toBeVisible();

    await page.goto("/pieces");
    await main
      .getByRole("navigation", { name: "Pieces by letter" })
      .getByRole("link", { name: "T", exact: true })
      .click();
    await expect(page).toHaveURL(/\/pieces\?letter=T$/);
    await expect(
      main.getByRole("link", { name: "Tavern Round" })
    ).toBeVisible();
  });
});

test("read a piece: infobox, links, a restricted piece, a stub", async ({
  page,
}) => {
  await page.goto("/pieces?letter=C");
  await waitForHydration(page);
  const main = page.getByRole("main");
  await main.getByRole("link", { name: "The Copper Kettle" }).click();
  await expect(page).toHaveURL(/\/pieces\/the-copper-kettle$/);
  const infobox = main.getByRole("complementary", { name: "About this piece" });
  await expect(
    infobox.getByRole("link", { name: "Wren of the Vale" })
  ).toHaveAttribute("href", "/bards/wren-of-the-vale");
  await infobox.getByRole("link", { name: "Known" }).click();
  await expect(page).toHaveURL(/#licensing$/);
  await expect(
    main.getByRole("heading", { level: 2, name: "Licensing" })
  ).toBeInViewport();
  await main
    .getByRole("navigation", { name: "Contents" })
    .getByRole("link", { name: "Where to find it" })
    .click();
  await expect(page).toHaveURL(/#where-to-find-it$/);
  await expect(
    main.getByRole("link", {
      name: "The Copper Kettle, with chords (external link)",
    })
  ).toHaveCount(3);

  await page.goto("/pieces/the-dragons-hoard");
  await waitForHydration(page);
  const text = "Show links (the creator asks that this isn’t shared further)";
  const details = main.locator("details", { hasText: text });
  await expect(
    main.locator('a[href*="private-recordings.example"]').first()
  ).toBeHidden();
  await details.getByText(text).click();
  await expect(details).toHaveAttribute("open", "");
  await expect(
    details
      .getByRole("link", { name: "The text of the poem (external link)" })
      .first()
  ).toBeVisible();

  await page.goto("/pieces/the-unfinished-lay");
  await expect(main.getByText("This page is a stub.")).toBeVisible();
});

test("history: tab, newest revision, then back to the first version", async ({
  page,
}) => {
  await page.goto("/pieces/the-copper-kettle");
  await waitForHydration(page);
  const main = page.getByRole("main");
  await main
    .getByRole("navigation", { name: "Page views" })
    .getByRole("link", { name: "History" })
    .click();
  await expect(page).toHaveURL(/\/pieces\/the-copper-kettle\/history$/);
  await main
    .getByRole("table", { name: "Revisions" })
    .getByRole("link", { name: /^View changes/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/revisions\/1014$/);
  await expect(
    main.getByRole("heading", { level: 2, name: "Changes" })
  ).toBeVisible();
  await main.getByRole("link", { name: "Previous revision" }).click();
  await expect(page).toHaveURL(/\/revisions\/1004$/);
  await expect(
    main.getByRole("heading", { level: 3, name: "Versions" })
  ).toBeVisible();
});

test("bards: a letter, a bard, a work; a bard with no page", async ({
  page,
}) => {
  await page.goto("/bards?letter=W");
  await waitForHydration(page);
  const main = page.getByRole("main");
  await main
    .getByRole("region", { name: "Bards under W" })
    .getByRole("link", { name: "Wren of the Vale" })
    .click();
  await expect(page).toHaveURL(/\/bards\/wren-of-the-vale$/);
  await main
    .getByRole("region", { name: "Works" })
    .getByRole("link", { name: "The Copper Kettle" })
    .click();
  await expect(page).toHaveURL(/\/pieces\/the-copper-kettle$/);

  await page.goto("/bards/hollis-fenn");
  await expect(
    main.getByText("Hollis Fenn has asked not to have a page here.")
  ).toBeVisible();
  await expect(main.getByRole("link", { name: "History" })).toHaveCount(0);
});

test("categories, collections and events lead on to their pages", async ({
  page,
}) => {
  const main = page.getByRole("main");
  await page.goto("/categories");
  await waitForHydration(page);
  await main
    .getByRole("region", { name: "Topic" })
    .getByRole("link", { name: "Swords" })
    .click();
  await expect(page).toHaveURL(/\/categories\/swords$/);
  await main
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByRole("link", { name: "Battles" })
    .click();
  await expect(
    main.getByRole("heading", { level: 1, name: "Battles" })
  ).toBeVisible();

  await page.goto("/collections");
  await main
    .getByRole("link", { name: "The Northmarch Songbook", exact: true })
    .click();
  await expect(page).toHaveURL(/\/collections\/12$/);
  await main.getByRole("link", { name: "The Copper Kettle" }).first().click();
  await expect(page).toHaveURL(/\/pieces\/the-copper-kettle$/);

  await page.goto("/events");
  await main.getByRole("link", { name: "Midwinter Revel" }).click();
  await expect(page).toHaveURL(/\/events\/midwinter-revel$/);
  await main
    .getByRole("region", { name: "Performances recorded here" })
    .getByRole("link", { name: "The Dragon’s Hoard" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/pieces\/the-dragons-hoard$/);
});

test("help, not found and the theme", async ({ page }) => {
  await page.goto("/help");
  await waitForHydration(page);
  const main = page.getByRole("main");
  await main.getByRole("link", { name: "Conservation status" }).first().click();
  await expect(page).toHaveURL(/\/help\/conservation-status$/);
  await main
    .getByRole("navigation", { name: "Contents" })
    .getByRole("link", { name: /How Restricted works$/ })
    .click();
  await expect(page).toHaveURL(/#how-restricted-works$/);

  const response = await page.goto("/wiki/Northmarch_Rising");
  expect(response?.status()).toBe(404);
  await expect(
    main.getByRole("link", { name: "Search for ‘Northmarch Rising’" })
  ).toHaveAttribute("href", "/search?q=Northmarch+Rising");
  await main.getByRole("link", { name: "Go to the home page" }).click();
  await expect(page).toHaveURL(/\/$/);

  await waitForHydration(page);
  const saved = page.waitForResponse("**/resources/theme**");
  await page.getByRole("banner").getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await saved;
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test.describe("sign in", () => {
  // Chromium follows the 302 to Auth0 itself; nothing there resolves (see
  // the config's resolver rules), so the guard allows that one hop.
  test.use({ offHostRedirects: ["auth0.invalid"] });

  test("stubbed sign-in, rename in settings, log out", async ({ page }) => {
    await page.goto("/auth/login?as=contributor&returnTo=/settings");
    await expect(page).toHaveURL(/\/settings$/);
    await waitForHydration(page);
    const banner = page.getByRole("banner");
    const account = banner.locator("summary").filter({ visible: true });
    await expect(account).toHaveText(/Account: Morwen of the /);

    const name = page
      .getByRole("main")
      .getByRole("textbox", { name: "Display name" });
    await name.fill("  Morwen of the Long Road ");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByRole("region", { name: "Notifications" })
    ).toContainText("Display name saved.");
    await expect(account).toHaveText(/Account: Morwen of the Long Road$/);

    await account.click();
    const request = page.waitForEvent(
      "requestfailed",
      r => new URL(r.url()).hostname === "auth0.invalid"
    );
    await page.getByRole("button", { name: "Log out" }).click();
    expect((await request).url()).toContain("auth0.invalid/v2/logout");
  });
});
