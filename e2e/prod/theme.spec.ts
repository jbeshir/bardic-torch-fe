import { expect, type Page } from "@playwright/test";
import {
  channelString,
  resolveColour,
  type Theme,
} from "../../app/styles/tokens";
import { checkpoint } from "../support/journey";
import { test } from "../support/test";

/**
 * The theme (DESIGN §6.24, R17): System by default, an explicit choice in
 * the `theme` cookie, rendered server-side so nothing flashes, switched
 * optimistically with JS and by a plain form post without it.
 */

const THEME_COOKIE = "theme";

/** The canvas token's channels, as the CSS custom property holds them. */
function canvas(theme: Theme): string {
  return channelString(resolveColour(theme, "canvas"));
}

/** What the page shows: the --canvas value and the painted background. */
async function rendered(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    return {
      attribute: root.getAttribute("data-theme"),
      canvas: style.getPropertyValue("--canvas").trim(),
      // The painted colour's numbers ("22 18 14"), to compare with the token.
      background: (style.backgroundColor.match(/\d+/g) ?? []).join(" "),
    };
  });
}

async function expectRenderedTheme(page: Page, theme: Theme) {
  await expect
    .poll(async () => {
      const { canvas: value, background } = await rendered(page);
      return { canvas: value, background };
    })
    .toEqual({ canvas: canvas(theme), background: canvas(theme) });
}

async function themeCookie(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.find(({ name }) => name === THEME_COOKIE);
}

test.describe("server-rendered theme", () => {
  test("raw HTML has data-theme=dark for a dark cookie and none without one", async ({
    request,
  }) => {
    const dark = await (
      await request.get("/", { headers: { Cookie: `${THEME_COOKIE}=dark` } })
    ).text();
    expect(dark).toMatch(/<html\b[^>]*\sdata-theme="dark"/);
    expect(dark).toMatch(/<meta name="color-scheme" content="dark"\/?>/);

    const system = await (await request.get("/")).text();
    expect(system).toMatch(/<html\b/);
    expect(system).not.toMatch(/<html\b[^>]*data-theme=/);
    expect(system).toMatch(
      /<meta name="color-scheme" content="light dark"\/?>/
    );
  });

  test("the stylesheet is a render-blocking link in <head>", async ({
    request,
    page,
  }) => {
    const html = await (await request.get("/")).text();
    const headHtml = html.slice(0, html.indexOf("</head>"));
    const links = headHtml.match(/<link\b[^>]*rel="stylesheet"[^>]*>/g) ?? [];
    expect(links).toHaveLength(1);
    expect(links[0]).not.toMatch(/\b(media|disabled|onload)=/);
    expect(html.indexOf(links[0] ?? "")).toBeLessThan(html.indexOf("</head>"));

    await page.goto("/");
    const placement = await page.evaluate(() => ({
      inHead: document.head.querySelectorAll('link[rel="stylesheet"]').length,
      inBody: document.body.querySelectorAll('link[rel="stylesheet"]').length,
      applied: document.styleSheets.length,
    }));
    expect(placement).toEqual({ inHead: 1, inBody: 0, applied: 1 });
  });

  test("a light cookie under an OS dark preference renders light", async ({
    page,
    baseURL,
  }) => {
    await page
      .context()
      .addCookies([{ name: THEME_COOKIE, value: "light", url: baseURL ?? "" }]);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    expect((await rendered(page)).attribute).toBe("light");
    await expectRenderedTheme(page, "light");
  });

  test("a dark cookie under an OS light preference renders dark", async ({
    page,
    baseURL,
  }) => {
    await page
      .context()
      .addCookies([{ name: THEME_COOKIE, value: "dark", url: baseURL ?? "" }]);
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await expectRenderedTheme(page, "dark");
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`with no cookie the page follows an OS ${scheme} preference`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/");
      expect((await rendered(page)).attribute).toBeNull();
      await expectRenderedTheme(page, scheme);
      await expect(
        page.getByRole("button", { name: "System" })
      ).toHaveAttribute("aria-pressed", "true");
    });
  }

  test("a forced-light wrapper under an OS dark preference gets the light tokens", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    const wrapper = await page.evaluate(() => {
      const element = document.createElement("div");
      element.setAttribute("data-theme", "light");
      document.body.appendChild(element);
      const value = getComputedStyle(element).getPropertyValue("--canvas");
      element.remove();
      return value.trim();
    });
    expect(wrapper).toBe(canvas("light"));
    await expectRenderedTheme(page, "dark");
  });
});

test.describe("theme toggle with JS", () => {
  test("switches before the server answers and persists across reload", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await page.waitForFunction(() => "__remixRouter" in window);

    // Hold the save so the optimistic switch can be seen on its own.
    let release: () => void = () => undefined;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    await page.route("**/resources/theme**", async route => {
      await held;
      await route.continue();
    });

    const dark = page.getByRole("button", { name: "Dark" });
    await dark.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(dark).toHaveAttribute("aria-pressed", "true");
    await expectRenderedTheme(page, "dark");
    expect(await themeCookie(page)).toBeUndefined();

    const saved = page.waitForResponse("**/resources/theme**");
    release();
    expect((await saved).status()).toBe(200);
    await page.unroute("**/resources/theme**");

    const cookie = await themeCookie(page);
    expect(cookie).toMatchObject({
      value: "dark",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
    });
    await checkpoint(page, "dark-choice");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expectRenderedTheme(page, "dark");

    const system = page.waitForResponse("**/resources/theme**");
    await page.getByRole("button", { name: "System" }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme");
    await system;
    expect(await themeCookie(page)).toBeUndefined();
    await expectRenderedTheme(page, "light");
  });
});

test.describe("theme toggle without JS", () => {
  test.use({ javaScriptEnabled: false });

  test("posts the choice and comes back to the page, rendered in that theme", async ({
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

    await Promise.all([
      page.waitForURL("/"),
      theme.getByRole("button", { name: "Dark" }).click(),
    ]);
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

  test("below md the choice is in the site menu after the content, and comes back there", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
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
