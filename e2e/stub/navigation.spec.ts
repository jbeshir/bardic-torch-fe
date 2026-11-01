import { expect, type Page } from "@playwright/test";
import { waitForHydration } from "../support/hydration";
import { checkpoint } from "../support/journey";
import {
  expectFocusNotObscured,
  expectNoHorizontalOverflow,
  expectPrimaryTargetsAtLeast44,
  settled,
} from "../support/layout";
import { accountPanel, accountTrigger, appBar } from "../support/shell";
import { test } from "../support/test";

/**
 * The shell's navigation (DESIGN §5, R18, R20, R26): the bottom app bar
 * below md, the navigation drawer with its real focus trap, the header
 * from md, the persistent sidebar from lg, the account menu signed out and
 * in, and the no-JS fallbacks. Stub phase, for stub sign-in.
 */

const MOBILE = { width: 360, height: 800 };

/** Waits for hydration: the Menu link has become a button. */
async function openHydrated(page: Page, path = "/"): Promise<void> {
  const response = await page.goto(path);
  expect(response?.status()).toBeLessThan(500);
  await waitForHydration(page);
}

/** The accessible label of whatever has focus, and whether it is inside `selector`. */
async function focused(page: Page, selector: string) {
  return page.evaluate(container => {
    const active = document.activeElement;
    return {
      inside: Boolean(
        active && document.querySelector(container)?.contains(active)
      ),
      label:
        active?.getAttribute("aria-label") ?? active?.textContent?.trim() ?? "",
    };
  }, selector);
}

test.describe("below md", () => {
  test.use({ viewport: MOBILE });

  test("the header holds only the home link; Menu, Search and Account are in the bottom bar", async ({
    page,
  }) => {
    await openHydrated(page);
    const banner = page.getByRole("banner");
    await expect(
      banner.getByRole("link", { name: "Bardic Torch" })
    ).toBeVisible();
    await expect(banner.getByRole("search")).toBeHidden();
    await expect(banner.getByRole("group", { name: "Theme" })).toBeHidden();

    const bar = appBar(page);
    const cells = [
      bar.getByRole("button", { name: "Menu" }),
      bar.getByRole("button", { name: "Search", exact: true }),
      bar.getByRole("link", { name: "Log in" }),
    ];
    await expectPrimaryTargetsAtLeast44(cells);
    const box = await bar.boundingBox();
    expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(MOBILE.height);
    expect(Math.round(box?.height ?? 0)).toBeGreaterThanOrEqual(56);
    await expectNoHorizontalOverflow(page);
  });

  test("the bar never covers the end of the page", async ({ page }) => {
    await openHydrated(page);
    // Instantly: under no-preference the page scrolls smoothly, and the
    // boxes would be measured part-way there.
    const gap = await page.evaluate(() => {
      const root = document.documentElement;
      window.scrollTo({ top: root.scrollHeight, behavior: "instant" });
      return root.scrollHeight - (window.scrollY + window.innerHeight);
    });
    expect(gap, "scrolled to the end of the page").toBeLessThanOrEqual(1);
    const footer = await page.getByRole("contentinfo").boundingBox();
    const bar = await appBar(page).boundingBox();
    expect(footer && bar).toBeTruthy();
    expect((footer?.y ?? 0) + (footer?.height ?? 0)).toBeLessThanOrEqual(
      (bar?.y ?? 0) + 1
    );
    await expectFocusNotObscured(page);
  });

  test("Menu opens the drawer as a bottom sheet that traps focus, closes on Escape and gives focus back", async ({
    page,
  }) => {
    await openHydrated(page, "/help/licence");
    const menu = appBar(page).getByRole("button", { name: "Menu" });
    await menu.click();
    const drawer = page.getByRole("dialog", { name: "Site menu" });
    await expect(drawer).toBeVisible();
    await expect(
      drawer.getByRole("button", { name: "Close menu" }).first()
    ).toBeFocused();
    await expect(drawer.getByRole("search")).toBeVisible();
    await expect(
      drawer.getByRole("navigation", { name: "Site" })
    ).toBeVisible();
    await expect(drawer.getByRole("group", { name: "Theme" })).toBeVisible();
    await expect(
      drawer.getByRole("link", { name: "Licence & attribution" })
    ).toHaveAttribute("aria-current", "page");

    // Tab all the way round, both ways: focus never leaves the drawer.
    const count = await drawer
      .locator("a[href], button, input:not([type=hidden])")
      .count();
    for (const key of ["Tab", "Shift+Tab"] as const) {
      for (let step = 0; step < count + 2; step += 1) {
        await page.keyboard.press(key);
        const { inside, label } = await focused(page, "dialog[open]");
        expect(inside, `focus left the drawer at "${label}" (${key})`).toBe(
          true
        );
      }
    }

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(menu).toBeFocused();
    await expect(page.locator("html")).not.toHaveClass(/overflow-hidden/);
  });

  test("the drawer closes when one of its links navigates", async ({
    page,
  }) => {
    await openHydrated(page);
    await appBar(page).getByRole("button", { name: "Menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Site menu" });
    await drawer.getByRole("link", { name: "FAQ for bards" }).click();
    await expect(page).toHaveURL(/\/help\/faq-for-bards$/);
    await expect(drawer).toBeHidden();
  });

  test("the drawer closes itself when the window grows to the sidebar", async ({
    page,
  }) => {
    await openHydrated(page);
    await appBar(page).getByRole("button", { name: "Menu" }).click();
    await expect(page.getByRole("dialog", { name: "Site menu" })).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByRole("dialog", { name: "Site menu" })).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Site" })).toBeVisible();
  });

  test("Search opens a sheet above the bar with the field focused; Escape closes it", async ({
    page,
  }) => {
    await openHydrated(page);
    // Exact: the sheet's submit is "Search the original wiki (…)".
    const search = appBar(page).getByRole("button", {
      name: "Search",
      exact: true,
    });
    await search.click();
    await expect(search).toHaveAttribute("aria-expanded", "true");
    const field = appBar(page).getByRole("searchbox", {
      name: "Search the original wiki",
    });
    await expect(field).toBeFocused();
    const sheet = await field.boundingBox();
    const bar = await appBar(page)
      .getByRole("button", { name: "Menu" })
      .boundingBox();
    expect((sheet?.y ?? 0) + (sheet?.height ?? 0)).toBeLessThanOrEqual(
      bar?.y ?? 0
    );
    await expect(appBar(page).getByRole("search")).toHaveAttribute(
      "action",
      /\/w\/index\.php$/
    );

    await page.keyboard.press("Escape");
    await expect(field).toBeHidden();
    await expect(search).toBeFocused();
  });

  test("signed in, Account opens its panel upwards, above the bar", async ({
    page,
  }) => {
    await page.goto("/auth/login?as=contributor&returnTo=/");
    await openHydrated(page);
    const account = accountTrigger(appBar(page));
    await expect(account).toHaveText(/Account: Morwen of the Marches$/);
    await account.click();
    const panel = await accountPanel(account);
    await expect(panel).toBeVisible();
    await expect(
      panel.getByText("Morwen of the Marches", { exact: true })
    ).toBeVisible();
    const panelBox = await panel.boundingBox();
    const accountBox = await account.boundingBox();
    expect(panelBox?.y ?? 999).toBeLessThan(accountBox?.y ?? 0);
    await expect(panel.getByRole("link", { name: "Settings" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(account).toBeFocused();
  });
});

test.describe("from md", () => {
  test("at md the header has Menu, search, theme and Log in, and no bottom bar", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await openHydrated(page);
    const banner = page.getByRole("banner");
    await expect(appBar(page)).toBeHidden();
    const menu = banner.getByRole("button", { name: "Menu" });
    await expectPrimaryTargetsAtLeast44([menu]);
    await expect(banner.getByRole("search")).toBeVisible();
    await expect(banner.getByRole("group", { name: "Theme" })).toBeVisible();
    await expect(banner.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Site" })).toBeHidden();

    await menu.click();
    const drawer = page.getByRole("dialog", { name: "Site menu" });
    await expect(drawer).toBeVisible();
    // It slides in from the left (translateX); measure where it comes to rest.
    await settled(drawer);
    const box = await drawer.boundingBox();
    expect(Math.round(box?.x ?? -1)).toBe(0);
    await drawer.getByRole("button", { name: "Close menu" }).first().click();
    await expect(menu).toBeFocused();
  });

  test("at lg the sidebar is always there, with the catalogue links going to the wiki", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openHydrated(page, "/help/contributing");
    const nav = page.getByRole("navigation", { name: "Site" });
    await expect(nav).toBeVisible();
    await expect(
      page.getByRole("banner").getByRole("button", { name: "Menu" })
    ).toBeHidden();
    await expect(
      nav.getByRole("link", { name: "Pieces (opens original wiki)" })
    ).toHaveAttribute("href", /\/wiki\/Category:Pieces$/);
    await expect(
      nav.getByRole("link", { name: "Contributing", exact: true })
    ).toHaveAttribute("aria-current", "page");
    const navBox = await nav.boundingBox();
    const mainBox = await page.getByRole("main").boundingBox();
    expect((navBox?.x ?? 0) + (navBox?.width ?? 0)).toBeLessThanOrEqual(
      mainBox?.x ?? 0
    );
  });

  test("Log in comes back to the page, then the account menu opens, closes on Escape and outside", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openHydrated(page, "/help/faq-for-bards");
    const login = page
      .getByRole("banner")
      .getByRole("link", { name: "Log in" });
    await expect(login).toHaveAttribute(
      "href",
      "/auth/login?returnTo=%2Fhelp%2Ffaq-for-bards"
    );
    await login.click();
    await expect(page).toHaveURL(/\/help\/faq-for-bards$/);
    // Stub sign-in is a full document load: the Escape handler needs JS.
    await waitForHydration(page);

    const trigger = accountTrigger(page.getByRole("banner"));
    await expect(trigger).toHaveText(/Account: Morwen of the Marches$/);
    await trigger.press("Enter");
    const panel = await accountPanel(trigger);
    await expect(panel.getByText("Contributor", { exact: true })).toBeVisible();
    await expect(panel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(panel).toBeVisible();
    await page.getByRole("main").click({ position: { x: 5, y: 5 } });
    await expect(panel).toBeHidden();
  });

  test("checkpoint: account-open", async ({ page }) => {
    await page.goto("/auth/login?as=contributor&returnTo=/");
    await page.setViewportSize({ width: 1280, height: 800 });
    await openHydrated(page);
    const trigger = accountTrigger(page.getByRole("banner"));
    await expect(trigger).toHaveText(/Account: Morwen of the Marches$/);
    await trigger.click();
    const panel = await accountPanel(trigger);
    await expect(panel.getByText("Contributor", { exact: true })).toBeVisible();
    await checkpoint(page, "account-open");
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false, viewport: MOBILE });

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
    await expectPrimaryTargetsAtLeast44([menu]);

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
          main.compareDocumentPosition(site) &
            Node.DOCUMENT_POSITION_FOLLOWING &&
          site.compareDocumentPosition(footer) &
            Node.DOCUMENT_POSITION_FOLLOWING
      );
    });
    expect(order).toBe(true);
  });

  test("the account panel opens and closes from its summary", async ({
    page,
  }) => {
    await page.goto("/auth/login?as=contributor&returnTo=/");
    const account = accountTrigger(appBar(page));
    await account.click();
    await expect(
      appBar(page).getByRole("button", { name: "Log out" })
    ).toBeVisible();
    await account.click();
    await expect(
      appBar(page).getByRole("button", { name: "Log out" })
    ).toBeHidden();
  });

  test("at lg the sidebar shows without JS too", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Site" })).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Site" })
        .getByRole("heading", { name: "Site menu" })
    ).toBeHidden();
  });
});
