import { expect } from "@playwright/test";
import { appBar } from "../support/shell";
import { expectPrimaryTargetsAtLeast44 } from "../support/layout";
import { test } from "../support/test";
import { expectRenderedTheme, themeCookie } from "../support/theme";

/**
 * The production build with scripting off (plan §0.11; this file runs in
 * the prod-no-js project, which disables JavaScript for the context): the
 * site menu that stands in for the drawer, the theme by a plain form post,
 * and the help pages' contents and links. The signed-in no-JS journeys
 * (the account disclosure, the settings notice) need stub sign-in, so they
 * are stub/no-js.spec.ts. axe can't run with scripting off, so the
 * no-JS markup's checkpoint is landing.spec.ts "server-html".
 */

const MOBILE = { width: 360, height: 800 };

test.describe("navigation below md", () => {
  test.use({ viewport: MOBILE });

  test("Menu and Search jump to the site menu after the content, which has search, theme and the nav", async ({
    page,
  }) => {
    await page.goto("/");
    const bar = appBar(page);
    const menu = bar.getByRole("link", { name: "Menu" });
    await expect(menu).toHaveAttribute("href", "#site-nav");
    await expect(
      bar.getByRole("link", { name: "Search", exact: true })
    ).toHaveAttribute("href", "#site-nav");
    await expectPrimaryTargetsAtLeast44([
      menu,
      bar.getByRole("link", { name: "Search", exact: true }),
    ]);

    await menu.click();
    await expect(page).toHaveURL(/#site-nav$/);
    const nav = page.getByRole("navigation", { name: "Site" });
    await expect(nav).toBeInViewport();
    await expect(nav.getByRole("heading", { name: "Site menu" })).toBeVisible();
    await expect(nav.getByRole("search")).toBeVisible();
    await expect(nav.getByRole("group", { name: "Theme" })).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "Mood (opens original wiki)" })
    ).toBeVisible();

    // It comes after main and before the footer.
    const order = await page.evaluate(() => {
      const main = document.querySelector("main");
      const site = document.getElementById("site-nav");
      const footer = document.querySelector("footer");
      return Boolean(
        main &&
        site &&
        footer &&
        main.compareDocumentPosition(site) & Node.DOCUMENT_POSITION_FOLLOWING &&
        site.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING
      );
    });
    expect(order).toBe(true);

    // Its links are ordinary links: the drawer's job, done without JS.
    await nav.getByRole("link", { name: "FAQ for bards" }).click();
    await expect(page).toHaveURL(/\/help\/faq-for-bards$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "FAQ for bards" })
    ).toBeVisible();
  });

  test("the choice of theme is in the site menu, and comes back to the page", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/help");
    const banner = page.getByRole("banner");
    await expect(banner.getByRole("group", { name: "Theme" })).toBeHidden();
    const nav = page.getByRole("navigation", { name: "Site" });
    await Promise.all([
      page.waitForURL("/help"),
      nav.getByRole("button", { name: "Dark" }).click(),
    ]);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(nav.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await nav.getByRole("button", { name: "System" }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  });
});

test.describe("from md", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("at lg the sidebar shows, its site menu heading kept for screen readers only", async ({
    page,
  }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Site" });
    await expect(nav).toBeVisible();
    // Visually hidden (sr-only), so the group h3s still sit under an h2.
    const heading = nav.getByRole("heading", { level: 2, name: "Site menu" });
    await expect(heading).toHaveCSS("position", "absolute");
    await expect(heading).toHaveCSS("width", "1px");
  });

  test("the header's theme toggle posts the choice and comes back, rendered in that theme", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    // From md the toggle is the header's. The site menu's copy below lg is
    // display: none here, but while the posted page is still loading its
    // stylesheet both are briefly exposed, so stay inside the banner.
    const theme = page
      .getByRole("banner")
      .getByRole("group", { name: "Theme" });

    const posted = page.waitForResponse(
      r =>
        r.request().method() === "POST" &&
        new URL(r.url()).pathname === "/resources/theme"
    );
    await Promise.all([
      page.waitForURL("/"),
      theme.getByRole("button", { name: "Dark" }).click(),
    ]);
    // The 303 back is a resource-route answer: it carries the security
    // headers too (R7).
    const redirect = await posted;
    expect(redirect.status()).toBe(303);
    expect(await redirect.headerValue("cache-control")).toBe("no-store");
    expect(await redirect.headerValue("content-security-policy")).toContain(
      "frame-ancestors 'none'"
    );
    expect(await redirect.headerValue("x-content-type-options")).toBe(
      "nosniff"
    );
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(theme.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expectRenderedTheme(page, "dark");
    expect((await themeCookie(page))?.value).toBe("dark");

    await theme.getByRole("button", { name: "System" }).click();
    await expect(theme.getByRole("button", { name: "System" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.locator("html")).not.toHaveAttribute("data-theme");
    expect(await themeCookie(page)).toBeUndefined();
    await expectRenderedTheme(page, "light");
  });
});

test.describe("help", () => {
  test.use({ viewport: MOBILE });

  test("a help page keeps its contents open, and they and the breadcrumb work", async ({
    page,
  }) => {
    await page.goto("/help/contributing");
    const main = page.getByRole("main");
    const contents = main.getByRole("navigation", { name: "Contents" });
    // Nothing folds it without JS, at any width.
    await expect(contents.locator("details")).toHaveAttribute("open", "");
    await contents.getByRole("link", { name: /How review works$/ }).click();
    await expect(page).toHaveURL(/#how-review-works$/);
    await expect(
      main.getByRole("heading", { level: 2, name: "How review works" })
    ).toBeInViewport();

    await main
      .getByRole("navigation", { name: "Breadcrumb" })
      .getByRole("link", { name: "Help" })
      .click();
    await expect(page).toHaveURL(/\/help$/);
    await main.getByRole("link", { name: "Licence & attribution" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Licence & attribution" })
    ).toBeVisible();
  });

  test("signed out, settings offers Log in back to it", async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("main").getByRole("link", { name: "Log in" })
    ).toHaveAttribute("href", "/auth/login?returnTo=%2Fsettings");
  });
});

test.describe("/pieces", () => {
  test("the search box, the letters and the pages are plain GET forms and links", async ({
    page,
  }) => {
    await page.goto("/pieces?kind=song&letter=W");
    const main = page.getByRole("main");
    // The search keeps the filters and drops the letter: the form's own GET,
    // in DOM order, answered 200 (an order-only difference isn't redirected).
    await main.getByRole("searchbox", { name: "Search pieces" }).fill("kettle");
    const [response] = await Promise.all([
      page.waitForResponse(r => new URL(r.url()).pathname === "/pieces"),
      main.getByRole("button", { name: "Search" }).click(),
    ]);
    expect(response.status()).toBe(200);
    await expect(page).toHaveURL(/\/pieces\?kind=song&q=kettle$/);
    await expect(
      main.getByRole("link", { name: "The Copper Kettle" })
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

    await page.goto("/pieces");
    await main
      .getByRole("navigation", { name: "Pagination" })
      .getByRole("link", { name: "Next" })
      .click();
    await expect(page).toHaveURL(/\/pieces\?page=2$/);
  });
});

// ---------------------------------------------------------------------------
// C2.2: the facet form without JS

test.describe("/pieces filters", () => {
  test("ticking boxes and Apply filters is the form's own GET, answered 200", async ({
    page,
  }) => {
    await page.goto("/pieces?letter=W");
    const main = page.getByRole("main");
    const filters = main.getByRole("region", { name: "Filters" });
    // The Filters link jumps to the column after the results.
    await expect(main.getByRole("link", { name: "Filters" })).toHaveAttribute(
      "href",
      "#filters"
    );
    await filters.getByRole("checkbox", { name: /^Song\b/ }).check();
    await filters.getByRole("radio", { name: "Hide stubs" }).check();
    const [response] = await Promise.all([
      page.waitForResponse(r => new URL(r.url()).pathname === "/pieces"),
      filters.getByRole("button", { name: "Apply filters" }).click(),
    ]);
    // In DOM order (the letter first, an empty sort never sent without q):
    // an order-only difference, so no redirect.
    expect(response.status()).toBe(200);
    await expect(page).toHaveURL(/\/pieces\?letter=W&kind=song&stub=false$/);
    await expect(
      main.getByRole("link", { name: "Remove Kind: Song" })
    ).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/pieces\?kind=song&stub=false&letter=W$/
    );
  });

  test("All pages sends an empty stub, answered 200 without it", async ({
    page,
  }) => {
    await page.goto("/pieces?stub=true");
    const filters = page
      .getByRole("main")
      .getByRole("region", { name: "Filters" });
    await filters.getByRole("radio", { name: "All pages" }).check();
    const [response] = await Promise.all([
      page.waitForResponse(r => new URL(r.url()).pathname === "/pieces"),
      filters.getByRole("button", { name: "Apply filters" }).click(),
    ]);
    expect(response.status()).toBe(200);
    await expect(page).toHaveURL(/\/pieces\?stub=$/);
  });

  test("the order applies with its Sort button", async ({ page }) => {
    await page.goto("/pieces?q=lament");
    const main = page.getByRole("main");
    await main.getByRole("combobox", { name: "Sort by" }).selectOption("title");
    const [response] = await Promise.all([
      page.waitForResponse(r => new URL(r.url()).pathname === "/pieces"),
      main.getByRole("button", { name: "Sort" }).click(),
    ]);
    expect(response.status()).toBe(200);
    await expect(page).toHaveURL(/sort=title/);
    await expect(main.getByRole("combobox", { name: "Sort by" })).toHaveValue(
      "title"
    );
  });
});

test.describe("/pieces filters below xl", () => {
  test.use({ viewport: MOBILE });

  test("Filters jumps to the filters after the results, which apply with their own button", async ({
    page,
  }) => {
    await page.goto("/pieces?letter=T");
    const main = page.getByRole("main");
    const link = main.getByRole("link", { name: "Filters" });
    await expect(link).toHaveAttribute("href", "#filters");
    await expectPrimaryTargetsAtLeast44([link]);
    await link.click();
    await expect(page).toHaveURL(/\?letter=T#filters$/);
    const filters = main.getByRole("region", {
      name: "Filters",
      exact: true,
    });
    await expect(filters).toBeInViewport();
    await filters.getByRole("checkbox", { name: /^Song\b/ }).check();
    const [response] = await Promise.all([
      page.waitForResponse(r => new URL(r.url()).pathname === "/pieces"),
      filters.getByRole("button", { name: "Apply filters" }).click(),
    ]);
    expect(response.status()).toBe(200);
    await expect(page).toHaveURL(/\/pieces\?letter=T&kind=song/);
  });
});

// ---------------------------------------------------------------------------
// C3.1: the catalogue search without JS

test.describe("/search", () => {
  test("the header search is a plain GET to /search, answered 200", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/help");
    const header = page.getByRole("banner");
    await header
      .getByRole("searchbox", { name: "Search the catalogue" })
      .fill("northmarch");
    const [response] = await Promise.all([
      page.waitForResponse(r => new URL(r.url()).pathname === "/search"),
      header.getByRole("button", { name: "Search", exact: true }).click(),
    ]);
    expect(response.status()).toBe(200);
    await expect(page).toHaveURL(/\/search\?q=northmarch$/);
    await expect(
      page.getByRole("main").getByRole("link", { name: "Northmarch Rising" })
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Track B (C4, C5): the piece and bard pages.
test.describe("/pieces/:slug", () => {
  test("every category chip shows, with no Show all button", async ({
    page,
  }) => {
    await page.goto("/pieces/the-long-road-north");
    const categories = page
      .getByRole("main")
      .getByRole("navigation", { name: "Categories" });
    await expect(categories.getByRole("link")).toHaveCount(15);
    await expect(categories.getByRole("button")).toHaveCount(0);
  });

  test("a restricted piece's links open from their disclosure", async ({
    page,
  }) => {
    await page.goto("/pieces/the-dragons-hoard");
    const main = page.getByRole("main");
    const details = main.locator("details", {
      hasText: "Show links (the creator asks that this isn’t shared further)",
    });
    await expect(details).not.toHaveAttribute("open");
    await details.locator("summary").click();
    await expect(details).toHaveAttribute("open", "");
    await expect(
      details
        .getByRole("link", { name: "The text of the poem (external link)" })
        .first() // listed under Text and under Licensing sources
    ).toBeVisible();
  });

  test("the Read and History tabs are links", async ({ page }) => {
    await page.goto("/pieces/the-copper-kettle");
    const views = page
      .getByRole("main")
      .getByRole("navigation", { name: "Page views" });
    await expect(views.getByRole("link", { name: "History" })).toHaveAttribute(
      "href",
      "/pieces/the-copper-kettle/history"
    );
  });
});

test.describe("/bards/:slug", () => {
  test("the works link to their pieces, and the tabs are links", async ({
    page,
  }) => {
    await page.goto("/bards/wren-of-the-vale");
    const main = page.getByRole("main");
    await expect(
      main
        .getByRole("navigation", { name: "Page views" })
        .getByRole("link", { name: "History" })
    ).toHaveAttribute("href", "/bards/wren-of-the-vale/history");
    await main
      .getByRole("region", { name: "Works" })
      .getByRole("link", { name: "The Copper Kettle" })
      .click();
    await expect(page).toHaveURL(/\/pieces\/the-copper-kettle$/);
  });
});

test.describe("/bards", () => {
  test("the filters are a plain GET form after the results, answered 200", async ({
    page,
  }) => {
    await page.goto("/bards?q=wren&letter=W");
    const main = page.getByRole("main");
    const filters = main.locator("details", { hasText: "Filters" });
    await expect(filters).not.toHaveAttribute("open");
    await filters.locator("summary").click();
    await main.getByRole("checkbox", { name: "Community bard" }).check();
    await main
      .getByRole("combobox", { name: "Affiliation" })
      .selectOption("barony-of-ashdown");
    const [response] = await Promise.all([
      page.waitForResponse(r => new URL(r.url()).pathname === "/bards"),
      main.getByRole("button", { name: "Apply filters" }).click(),
    ]);
    // The form's own GET, in DOM order: an order-only difference.
    expect(response.status()).toBe(200);
    await expect(page).toHaveURL(
      /\/bards\?q=wren&letter=W&kind=community_bard&affiliation=barony-of-ashdown$/
    );
    await expect(
      main.getByRole("link", { name: "Wren of the Vale" })
    ).toBeVisible();
  });
});
