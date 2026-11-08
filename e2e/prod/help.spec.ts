import { expect } from "@playwright/test";
import { checkpoint } from "../support/journey";
import { expectNoLayoutShift, SUB_PIXEL } from "../support/layout";
import { waitForHydration } from "../support/hydration";
import { test } from "../support/test";

// Every test opens its own page and shares no state, so they spread over
// the workers instead of queueing behind this file's checkpoints.
test.describe.configure({ mode: "parallel" });

/**
 * The help pages from the production build (DESIGN §10.2, R24): each one's
 * checkpoint, the infobox's
 * place at 360 and 1280, the contents, and the index's cards. Their
 * layout sweep is a row each in support/journey-pages.ts.
 */

type HelpPageCase = {
  readonly path: string;
  readonly title: string;
  /** The checkpoint name (declared in support/checkpoints.ts). */
  readonly checkpoint: string;
  /** The original wiki page the "Adapted from" link goes to. */
  readonly source: string | null;
  readonly infobox: boolean;
  readonly contents: boolean;
};

const PAGES: readonly HelpPageCase[] = [
  {
    path: "/help",
    title: "Help",
    checkpoint: "index",
    source: null,
    infobox: false,
    contents: false,
  },
  {
    path: "/help/contributing",
    title: "Contributing guide",
    checkpoint: "contributing",
    source: "Get_Started_Contributing",
    infobox: true,
    contents: true,
  },
  {
    path: "/help/faq-for-bards",
    title: "FAQ for bards",
    checkpoint: "faq-for-bards",
    source: "FAQ_for_Bards",
    infobox: false,
    contents: true,
  },
  {
    path: "/help/bard-preference-checklist",
    title: "Bard preference checklist",
    checkpoint: "bard-preference-checklist",
    source: "Bard_Preference_Checklist",
    infobox: true,
    contents: true,
  },
  {
    path: "/help/conservation-status",
    title: "Conservation status",
    checkpoint: "conservation-status",
    source: "Conservation_Status",
    infobox: true,
    contents: true,
  },
  {
    path: "/help/licence",
    title: "Licence & attribution",
    checkpoint: "licence",
    source: "Main_Page",
    infobox: true,
    contents: true,
  },
];

for (const help of PAGES) {
  test(`${help.path} renders and passes its checkpoint`, async ({ page }) => {
    const response = await page.goto(help.path);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(`${help.title} · Bardic Torch`);
    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { level: 1, name: help.title })
    ).toBeVisible();
    await expect(
      main.getByText(/^This page is available under CC BY-SA 4\.0/)
    ).toBeVisible();
    if (help.source) {
      await expect(
        main.getByRole("link", {
          name: "Adapted from the original wiki (opens original wiki)",
        })
      ).toHaveAttribute("href", new RegExp(`/wiki/${help.source}$`));
      await expect(
        main.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link")
      ).toHaveText(["Help"]);
    }
    await checkpoint(page, help.checkpoint);
  });
}

for (const help of PAGES.filter(({ infobox }) => infobox)) {
  test(`${help.path}: the infobox stacks above the content at 360 and floats right at 1280`, async ({
    page,
  }) => {
    const main = page.getByRole("main");
    const infobox = main.getByRole("complementary", { name: "At a glance" });
    const intro = main.locator(".prose-bt > p").first();

    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(help.path);
    const [narrowBox, narrowIntro] = await Promise.all([
      infobox.boundingBox(),
      intro.boundingBox(),
    ]);
    expect(narrowBox && narrowIntro).toBeTruthy();
    if (narrowBox && narrowIntro) {
      // Above the prose, as wide as it.
      expect(narrowBox.y + narrowBox.height).toBeLessThanOrEqual(narrowIntro.y);
      expect(Math.abs(narrowBox.x - narrowIntro.x)).toBeLessThan(SUB_PIXEL);
      expect(narrowBox.width).toBeGreaterThan(narrowIntro.width - SUB_PIXEL);
    }
    // Below the title rule: the first thing in the content.
    const rule = await main.getByText("Read", { exact: true }).boundingBox();
    expect(narrowBox && rule && narrowBox.y > rule.y).toBe(true);

    await page.setViewportSize({ width: 1280, height: 800 });
    const [wideBox, wideIntro] = await Promise.all([
      infobox.boundingBox(),
      intro.boundingBox(),
    ]);
    expect(wideBox && wideIntro).toBeTruthy();
    if (wideBox && wideIntro) {
      // Floated right at its own width, starting level with the intro,
      // whose lines wrap beside it.
      // At most w-infobox-xl (20rem).
      expect(wideBox.width).toBeLessThan(320 + SUB_PIXEL);
      expect(wideBox.x).toBeGreaterThan(wideIntro.x + wideIntro.width / 2);
      expect(Math.abs(wideBox.y - wideIntro.y)).toBeLessThanOrEqual(24);
    }
  });

  test(`${help.path}: the contents box never runs under the floated infobox`, async ({
    page,
  }) => {
    const main = page.getByRole("main");
    const infobox = main.getByRole("complementary", { name: "At a glance" });
    const contents = main.getByRole("navigation", { name: "Contents" });
    for (const width of [768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(help.path);
      if ((await contents.count()) === 0) continue;
      const [box, toc] = await Promise.all([
        infobox.boundingBox(),
        contents.boundingBox(),
      ]);
      expect(box && toc).toBeTruthy();
      if (box && toc) {
        // Beside the float (narrowed by it) or below it, never behind it.
        const beside = toc.x + toc.width <= box.x + 1;
        const below = toc.y >= box.y + box.height - 1;
        expect(beside || below, `at ${width}`).toBe(true);
      }
    }
  });
}

test("the contents fold below md and jump to their section", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/help/contributing");
  await waitForHydration(page);
  const contents = page
    .getByRole("main")
    .getByRole("navigation", { name: "Contents" });
  const details = contents.locator("details");
  // Open in the server's HTML, folded once the page has hydrated.
  await expect(details).not.toHaveAttribute("open", "");
  await contents.getByText("Contents", { exact: true }).click();
  await expect(details).toHaveAttribute("open", "");
  await contents.getByRole("link", { name: /How review works$/ }).click();
  await expect(page).toHaveURL(/#how-review-works$/);
  await expect(
    page.getByRole("heading", { level: 2, name: "How review works" })
  ).toBeInViewport();

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/help/faq-for-bards");
  await expect(
    page
      .getByRole("main")
      .getByRole("navigation", { name: "Contents" })
      .locator("details")
  ).toHaveAttribute("open", "");
});

test("the help index has a card for each help page, and each one opens it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/help");
  const cards = page.getByRole("main").getByRole("listitem");
  // Cards, not prose bullets: no marker, no list indent or item spacing
  // from the prose styles, and each row's tops level. (An <li> stays
  // `display: list-item` whatever its marker, so the marker is what counts.)
  const list = page.getByRole("main").getByRole("list");
  await expect(list).toHaveCount(1);
  expect(
    await list.evaluate(element => getComputedStyle(element).paddingLeft)
  ).toBe("0px");
  for (const item of await cards.all()) {
    expect(
      await item.evaluate(element => {
        const style = getComputedStyle(element);
        return {
          marker: style.listStyleType,
          markerContent: getComputedStyle(element, "::marker").content,
          marginTop: style.marginTop,
        };
      })
    ).toEqual({ marker: "none", markerContent: "normal", marginTop: "0px" });
  }
  const [first, second] = await Promise.all([
    cards.nth(0).boundingBox(),
    cards.nth(1).boundingBox(),
  ]);
  expect(first && second && Math.abs(first.y - second.y)).toBe(0);
  const titles = PAGES.filter(({ path }) => path !== "/help").map(
    ({ title }) => title
  );
  for (const title of titles) {
    await expect(
      cards.getByRole("heading", { level: 3, name: title })
    ).toBeVisible();
  }
  for (const { path, title } of PAGES.filter(({ path }) => path !== "/help")) {
    await page.goto("/help");
    await page.getByRole("main").getByRole("link", { name: title }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(
      page.getByRole("heading", { level: 1, name: title })
    ).toBeVisible();
  }
});

test("an in-page link goes to its section, and the breadcrumb back to Help", async ({
  page,
}) => {
  await page.goto("/help/faq-for-bards");
  const main = page.getByRole("main");
  await main.getByRole("link", { name: "above", exact: true }).click();
  await expect(page).toHaveURL(/#why-cant-i-just-tell-you-im-the-bard$/);
  await expect(
    main.getByRole("heading", {
      level: 2,
      name: "Why can’t I just tell you I’m the bard?",
    })
  ).toBeInViewport();
  await main
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByRole("link", { name: "Help" })
    .click();
  await expect(page).toHaveURL(/\/help$/);
});

test("the conservation infobox jumps to its statuses, and the table fits at 320", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/help/conservation-status");
  const main = page.getByRole("main");
  const table = main.getByRole("table");
  const tableBox = await table.boundingBox();
  const proseBox = await main.locator(".prose-bt").boundingBox();
  expect(tableBox && proseBox).toBeTruthy();
  if (tableBox && proseBox) {
    expect(tableBox.x + tableBox.width).toBeLessThanOrEqual(
      proseBox.x + proseBox.width + 1
    );
  }
  await main
    .getByRole("complementary", { name: "At a glance" })
    .getByRole("link", { name: "Restricted" })
    .click();
  await expect(page).toHaveURL(/#how-restricted-works$/);
  await expect(
    main.getByRole("heading", { level: 2, name: "How Restricted works" })
  ).toBeInViewport();
  // The other statuses each go to their own row of the table.
  await main
    .getByRole("complementary", { name: "At a glance" })
    .getByRole("link", { name: "Critically endangered" })
    .click();
  await expect(page).toHaveURL(/#critically-endangered$/);
  await expect(main.locator("tr#critically-endangered")).toBeInViewport();
});

test("the licence page links the licence, the original wiki and its contributors", async ({
  page,
}) => {
  await page.goto("/help/licence");
  const main = page.getByRole("main");
  await expect(
    main.getByRole("link", {
      name: "Creative Commons Attribution-ShareAlike 4.0 International licence (external link)",
    })
  ).toHaveAttribute("href", "https://creativecommons.org/licenses/by-sa/4.0/");
  await expect(
    main.getByRole("link", {
      name: "original wiki’s list of users (opens original wiki)",
    })
  ).toHaveAttribute("href", /\/wiki\/Special:ListUsers$/);
  await expect(main).toContainText(
    "Thank you to every editor who added a bard, a piece, a link or a category."
  );
});

test("an unknown help page is the 404 page", async ({ page }) => {
  const response = await page.goto("/help/lyrics");
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle("Page not found · Bardic Torch");
  await expect(
    page
      .getByRole("main")
      .getByRole("heading", { level: 1, name: "We couldn’t find that page" })
  ).toBeVisible();
});

test("at 360 nothing on a help page moves as it loads, the contents folding included", async ({
  page,
}) => {
  await expectNoLayoutShift(page, "/help/contributing", {
    width: 360,
    height: 800,
  });
});
