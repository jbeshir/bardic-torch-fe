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
