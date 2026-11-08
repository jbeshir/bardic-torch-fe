import { expect } from "@playwright/test";
import { checkpoint } from "../support/journey";
import { expectNoLayoutShift, FOCUSABLE, SUB_PIXEL } from "../support/layout";
import { HOME_HEADLINE } from "../support/pages";
import { waitForHydration } from "../support/hydration";
import { appBar } from "../support/shell";
import { test } from "../support/test";

// Every test opens its own page and shares no state, so they spread over
// the workers instead of queueing behind this file's checkpoints.
test.describe.configure({ mode: "parallel" });

test("the home page renders from the production build", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(
    page
      .getByRole("main")
      .getByRole("heading", { level: 1, name: HOME_HEADLINE })
  ).toBeVisible();
  await expect(page).toHaveTitle("Bardic Torch");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /^A community index of SCA bardic songs, stories and poems/
  );
  await checkpoint(page, "home");
});

test("checkpoint: server-html, the home page as served, before or without JS", async ({
  page,
}) => {
  // axe needs scripting, so instead of turning it off, no script of the
  // app's loads: the page stays exactly as the server sent it, the markup
  // a reader without JS gets (bar Menu and Search are links to the site
  // menu after the content), less <noscript>, which the home page hasn't.
  await page.route(
    url => url.pathname.endsWith(".js"),
    route => route.abort()
  );
  await page.setViewportSize({ width: 360, height: 800 });
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  const bar = appBar(page);
  await expect(bar.getByRole("link", { name: "Menu" })).toHaveAttribute(
    "href",
    "#site-nav"
  );
  expect(await page.evaluate(() => "__reactRouterDataRouter" in window)).toBe(
    false
  );
  await expect(page.locator("noscript")).toHaveCount(0);
  await checkpoint(page, "server-html");
});

test("the home page says what the site is and leads into the catalogue and to contributing", async ({
  page,
}) => {
  await page.goto("/");
  const main = page.getByRole("main");

  // Mission: an index, not an archive; links only; conservation; anyone can
  // contribute, with moderation; not affiliated.
  const why = main.getByRole("region", { name: "Why Bardic Torch" });
  await expect(why.getByRole("heading", { level: 3 })).toHaveText([
    "An index, not an archive",
    "Every version, everywhere",
    "Anyone can contribute",
  ]);
  await expect(why).toContainText("We never host lyrics, recordings or video");
  await expect(
    why.getByRole("link", { name: "How conservation statuses work" })
  ).toHaveAttribute("href", "/help/conservation-status");
  await expect(
    main.getByText(
      "Information: Bardic Torch is community-maintained and not affiliated with the Society for Creative Anachronism or any other organisation."
    )
  ).toBeVisible();

  // The catalogue is here: Browse pieces is the primary action, the counts
  // sit under the search, and every chip is an internal link.
  await expect(
    main.getByRole("link", { name: "Browse pieces", exact: true })
  ).toHaveAttribute("href", "/pieces");
  await expect(
    main.getByText(/^\d[\d,]* pieces and \d[\d,]* people and groups so far$/)
  ).toBeVisible();
  const explore = main.getByRole("region", { name: "Start exploring" });
  const chips = explore.getByRole("link");
  await expect(chips.first()).toHaveText(/^Song \(\d+\)$/);
  await expect(chips.first()).toHaveAttribute("href", "/pieces?kind=song");
  await expect(
    explore.getByRole("link", { name: "All categories" })
  ).toHaveAttribute("href", "/categories");
  await expect(
    explore.getByRole("link", { name: "Collections" })
  ).toHaveAttribute("href", "/collections");
  await expect(
    explore.getByRole("link", { name: "Events and venues" })
  ).toHaveAttribute("href", "/events");
  for (const href of await chips.evaluateAll(links =>
    links.map(link => link.getAttribute("href"))
  )) {
    expect(href).toMatch(/^\//);
  }
  await expect(
    main.getByRole("search").getByRole("searchbox", {
      name: "Search the catalogue",
    })
  ).toBeVisible();

  // The primary action stays on this site.
  await main.getByRole("link", { name: "How to contribute" }).first().click();
  await expect(page).toHaveURL(/\/help\/contributing$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Contributing guide" })
  ).toBeVisible();
});

test("the shell has one of each landmark and a skip link to the content", async ({
  page,
}) => {
  await page.goto("/");
  // Hydration hides the sidebar below lg, which changes the Tab order.
  await waitForHydration(page);
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("contentinfo")).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "Site" })).toHaveCount(1);

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.keyboard.press("Tab");
  // The next stop is the content's first control, not the header or <body>.
  const next = await page.evaluate(selector => {
    const main = document.querySelector("main");
    const first = [
      ...(main?.querySelectorAll<HTMLElement>(selector) ?? []),
    ].find(element => element.getClientRects().length > 0);
    return {
      firstInMain: first !== undefined && first === document.activeElement,
      label: document.activeElement?.textContent?.trim().slice(0, 40) ?? "",
    };
  }, FOCUSABLE);
  expect(next.label).not.toBe("");
  expect(next.firstInMain, `focused "${next.label}"`).toBe(true);
});

test("the header links home, searches the catalogue and has the theme and Log in from md", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/help");
  const banner = page.getByRole("banner");
  await expect(
    banner.getByRole("link", { name: "Bardic Torch" })
  ).toHaveAttribute("href", "/");
  const search = banner.getByRole("search");
  await expect(search).toHaveAttribute("method", "get");
  await expect(search).toHaveAttribute("action", "/search");
  await expect(
    search.getByRole("searchbox", { name: "Search the catalogue" })
  ).toHaveAttribute("name", "q");
  await expect(banner.getByRole("group", { name: "Theme" })).toBeVisible();
  await expect(banner.getByRole("link", { name: "Log in" })).toHaveAttribute(
    "href",
    "/auth/login?returnTo=%2Fhelp"
  );
});

test("the footer has the licence, the non-affiliation statement and the help links", async ({
  page,
}) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await expect(
    footer.getByRole("link", {
      name: /Creative Commons Attribution-ShareAlike 4\.0/,
    })
  ).toHaveAttribute("href", "https://creativecommons.org/licenses/by-sa/4.0/");
  await expect(footer).toContainText(
    "Bardic Torch is community-maintained and not affiliated with the Society for Creative Anachronism or any other organisation."
  );
  await expect(
    footer.getByRole("list", { name: "Help" }).getByRole("link")
  ).toHaveText([/^Contact/, "Help", "Licence & attribution", /^Original wiki/]);
});

test("at 360 the hero buttons stack full width, primary first", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  const main = page.getByRole("main");
  const contribute = main
    .getByRole("link", { name: "How to contribute" })
    .first();
  const browse = main.getByRole("link", { name: "Browse pieces", exact: true });
  const search = main.getByRole("searchbox", {
    name: "Search the catalogue",
  });
  const [first, second, field] = await Promise.all(
    [browse, contribute, search].map(locator => locator.boundingBox())
  );
  expect(first && second && field).toBeTruthy();
  if (first && second && field) {
    expect(first.y + first.height).toBeLessThanOrEqual(second.y);
    expect(second.y + second.height).toBeLessThanOrEqual(field.y);
    expect(Math.abs(first.width - second.width)).toBeLessThan(SUB_PIXEL);
    expect(Math.abs(first.x - second.x)).toBeLessThan(SUB_PIXEL);
  }
});

// CLS = 0 (plan §0.11): at 360 and 768 hydration hides the no-JS site menu
// after the content; at 1280 the sidebar stays.
for (const viewport of [
  { width: 360, height: 800 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
]) {
  test(`at ${viewport.width}px nothing on the home page moves as it loads, fonts and hydration included`, async ({
    page,
  }) => {
    await expectNoLayoutShift(page, "/", viewport);
  });
}
