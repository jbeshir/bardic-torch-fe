import { expect } from "@playwright/test";
import { waitForHydration } from "../support/hydration";
import { checkpoint } from "../support/journey";
import { test } from "../support/test";
import {
  canvas,
  expectRenderedTheme,
  rendered,
  themeCookie,
} from "../support/theme";

/**
 * The theme (DESIGN §6.24, R17): System by default, an explicit choice in
 * the `theme` cookie, rendered server-side so nothing flashes, switched
 * optimistically with JS and by a plain form post without it (that one is
 * in no-js.spec.ts).
 */

const THEME_COOKIE = "theme";

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
    await waitForHydration(page);

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
    const answer = await saved;
    expect(answer.status()).toBe(200);
    expect(await answer.headerValue("cache-control")).toBe("no-store");
    const csp = (await answer.headerValue("content-security-policy")) ?? "";
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+'/);
    expect(csp).toContain("form-action 'self' https://auth0.invalid");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(await answer.headerValue("x-content-type-options")).toBe("nosniff");
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
    await waitForHydration(page);
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

test.describe("theme toggle when the save fails", () => {
  test("a 503 the app didn't make reverts the choice and says so under the control, the page stays", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await waitForHydration(page);
    await page.route("**/resources/theme**", route =>
      route.fulfill({ status: 503, contentType: "text/html", body: "" })
    );

    const saved = page.waitForResponse("**/resources/theme**");
    await page.getByRole("button", { name: "Dark" }).click();
    expect((await saved).status()).toBe(503);

    const banner = page.getByRole("banner");
    await expect(
      banner.getByText("Couldn't save your theme. Try again.")
    ).toBeVisible();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme");
    await expect(page.getByRole("button", { name: "System" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    // Still the app's page in its shell, not the standalone error page.
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Site" })).toBeAttached();
    await expectRenderedTheme(page, "light");
    expect(await themeCookie(page)).toBeUndefined();
  });
});
