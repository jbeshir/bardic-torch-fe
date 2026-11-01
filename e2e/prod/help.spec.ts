import { expect } from "@playwright/test";
import { checkpoint } from "../support/journey";
import {
  expectFocusNotObscured,
  expectNoHorizontalOverflow,
  expectTargetSizesAtLeast24,
} from "../support/layout";
import { hydrated } from "../support/shell";
import { test } from "../support/test";

/**
 * The help pages from the production build (DESIGN §10.2, R24): each one's
 * checkpoint, reflow, target sizes and focus visibility, the infobox's
 * place at 360 and 1280, the contents, and the index's cards.
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
];

for (const help of PAGES) {
  test(`${help.path} renders, passes its checkpoint and reflows`, async ({
    page,
  }) => {
    test.slow();
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
    await expectNoHorizontalOverflow(page);
    await expectTargetSizesAtLeast24(page);
    await expectFocusNotObscured(page);
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
      expect(Math.abs(narrowBox.x - narrowIntro.x)).toBeLessThanOrEqual(1);
      expect(narrowBox.width).toBeGreaterThanOrEqual(narrowIntro.width - 1);
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
      // Beside the intro, on its right, starting level with it.
      expect(wideBox.x).toBeGreaterThan(wideIntro.x + wideIntro.width - 1);
      expect(Math.abs(wideBox.y - wideIntro.y)).toBeLessThanOrEqual(24);
    }
  });
}

test("the contents fold below md and jump to their section", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/help/contributing");
  await hydrated(page);
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
  await page.goto("/help");
  const cards = page.getByRole("main").getByRole("listitem");
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
      name: "Why can't I just tell you I'm the bard?",
    })
  ).toBeInViewport();
  await main
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByRole("link", { name: "Help" })
    .click();
  await expect(page).toHaveURL(/\/help$/);
});

test("an unknown help page is the 404 page", async ({ page }) => {
  const response = await page.goto("/help/lyrics");
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle("Page not found · Bardic Torch");
  await expect(
    page
      .getByRole("main")
      .getByRole("heading", { level: 1, name: "We couldn't find that page" })
  ).toBeVisible();
});
