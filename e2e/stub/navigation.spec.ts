import { expect, type Locator, type Page } from "@playwright/test";
import { waitForHydration } from "../support/hydration";
import { checkpoint } from "../support/journey";
import {
  expectNoHorizontalOverflow,
  expectPrimaryTargetsAtLeast44,
  expectTargetSizesAtLeast24,
  settled,
  SUB_PIXEL,
} from "../support/layout";
import {
  accountPanel,
  accountTrigger,
  appBar,
  openShownAccountPanel,
} from "../support/shell";
import { test } from "../support/test";
import {
  applyTextSpacing,
  applyWiderText,
  expectNothingCutOff,
} from "../support/text-spacing";

/**
 * The shell's navigation (DESIGN §5, R18, R20, R26): the bottom app bar
 * below md, the navigation drawer with its real focus trap, the header
 * from md, the persistent sidebar from lg, and the account menu signed out
 * and in. Stub phase, for stub sign-in. The no-JS fallbacks are the
 * no-js.spec.ts files.
 */

const MOBILE = { width: 360, height: 800 };
/** Where the sidebar takes over from the drawer (Tailwind `lg`). */
const LG = 1024;

/** Waits for hydration: the Menu link has become a button. */
async function openHydrated(page: Page, path = "/"): Promise<void> {
  const response = await page.goto(path);
  expect(response?.status()).toBeLessThan(500);
  await waitForHydration(page);
}

/**
 * The site menu as this width shows it, for the drawer-open checkpoint:
 * below lg the drawer, opened from the Menu button showing here (the app
 * bar's, then the header's from md); from lg the drawer has closed itself
 * and the menu is the persistent sidebar.
 */
async function showSiteMenu(page: Page): Promise<void> {
  const drawer = page.getByRole("dialog", { name: "Site menu" });
  if ((page.viewportSize()?.width ?? 0) >= LG) {
    await expect(drawer).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Site" })).toBeVisible();
    return;
  }
  if (!(await drawer.isVisible())) {
    await page
      .getByRole("banner")
      .getByRole("button", { name: "Menu", exact: true })
      .click();
  }
  await expect(drawer).toBeVisible();
  await settled(drawer);
}

/**
 * Below md, scrolled to the end of the page, the app bar covers none of
 * it: the footer ends at or above the bar's top. The page's room for the
 * bar is the bar's whole box (`pb-app-bar` and `h-app-bar` are one
 * expression), so this holds whatever the fonts make the page's height.
 *
 * The one allowance is sub-pixel, and measured rather than assumed: the
 * scroll extent (`scrollHeight`) is the document's height rounded to a
 * whole pixel, so when the height ends in a fraction rounded down (CI's
 * DejaVu Sans: 3192.34375 → 3192) the last fraction of a pixel can't be
 * scrolled into view, and the footer ends that fraction below the bar's
 * top. That remainder is computed from the page, and is under half a pixel.
 */
async function expectBarClearOfPageEnd(page: Page): Promise<void> {
  // Instantly: under no-preference the page scrolls smoothly, and the
  // boxes would be measured part-way there.
  const { gap, unscrollable } = await page.evaluate(() => {
    const root = document.documentElement;
    window.scrollTo({ top: root.scrollHeight, behavior: "instant" });
    return {
      gap: root.scrollHeight - (window.scrollY + window.innerHeight),
      unscrollable: Math.max(
        0,
        root.getBoundingClientRect().height - root.scrollHeight
      ),
    };
  });
  expect(gap, "scrolled to the end of the page").toBeLessThanOrEqual(1);
  expect(unscrollable, "only rounding is out of reach").toBeLessThan(SUB_PIXEL);
  const footer = await page.getByRole("contentinfo").boundingBox();
  const bar = await appBar(page).boundingBox();
  if (!footer || !bar) throw new Error("not laid out");
  expect(footer.y + footer.height).toBeLessThanOrEqual(bar.y + unscrollable);
}

/**
 * At 1280 × 800 (`prepare` runs after each page load): on a help page the
 * sidebar shows the current page clear of the "more below" fade, and the
 * fade's solid end meets the sidebar's foot; on any page the whole Help
 * group fits above the fold, clear of the fade too, and the fade goes once
 * the sidebar is scrolled to its end.
 */
async function expectSidebarFold(
  page: Page,
  prepare: () => Promise<void>
): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openHydrated(page, "/help/licence");
  await prepare();
  const nav = page.getByRole("navigation", { name: "Site" });
  const current = nav.getByRole("link", { name: "Licence & attribution" });
  await expect(current).toHaveAttribute("aria-current", "page");
  await expect(current).toBeInViewport({ ratio: 1 });
  // The fade is a cue at the sidebar's visible foot: its solid end meets
  // the foot, and it never lies over the current page's item.
  const more = page.getByTestId("sidebar-more");
  await expect(more).toBeVisible();
  const [navBox, moreBox, currentBox] = await Promise.all([
    nav.boundingBox(),
    more.boundingBox(),
    current.boundingBox(),
  ]);
  if (!navBox || !moreBox || !currentBox) throw new Error("not laid out");
  expect(
    Math.abs(moreBox.y + moreBox.height - (navBox.y + navBox.height))
  ).toBeLessThan(SUB_PIXEL);
  expect(currentBox.y + currentBox.height).toBeLessThanOrEqual(moreBox.y);
  // The whole Help group fits above the fold on any page, clear of the fade.
  await openHydrated(page, "/");
  await prepare();
  const last = nav.getByRole("link", { name: "Licence & attribution" });
  await expect(last).toBeInViewport({ ratio: 1 });
  await expect(more).toBeVisible();
  const [lastBox, fadeBox] = await Promise.all([
    last.boundingBox(),
    more.boundingBox(),
  ]);
  if (!lastBox || !fadeBox) throw new Error("not laid out");
  expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(fadeBox.y);
  await nav.evaluate(element => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(more).toBeHidden();
  await expect(
    nav.getByRole("link", { name: "Start contributing" })
  ).toBeInViewport();
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

  test("the footer's help links wrap without a separator starting a line", async ({
    page,
  }) => {
    await openHydrated(page);
    const list = page.getByRole("contentinfo").getByRole("list", {
      name: "Help",
    });
    const marks = await list.evaluate(element => {
      // The list clips its first 1rem: the marks that start a line.
      const clip = element.getBoundingClientRect().left + 16;
      return [...element.querySelectorAll(":scope > li")].map(item => {
        const mark = item.firstElementChild?.getBoundingClientRect();
        const box = item.getBoundingClientRect();
        return {
          startsLine:
            Math.abs(box.left - element.getBoundingClientRect().left) < 1,
          shown: mark ? mark.left >= clip - 0.5 : false,
          top: box.top,
        };
      });
    });
    // It does wrap at 360, so this checks the wrapped case.
    expect(
      new Set(marks.map(({ top }) => Math.round(top))).size
    ).toBeGreaterThan(1);
    for (const { startsLine, shown } of marks) {
      expect(shown).toBe(!startsLine);
    }
  });

  test("the bar never covers the end of the page", async ({ page }) => {
    await openHydrated(page);
    await expectBarClearOfPageEnd(page);
    // Focus behind the bar is the journey-page sweep's (sweeps.spec.ts).
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

  test("checkpoint: drawer-open", async ({ page }) => {
    await openHydrated(page, "/help/licence");
    await showSiteMenu(page);
    // The drawer is a dialog: only its controls are targets while it is open.
    await expectTargetSizesAtLeast24(page, [360, 768]);
    await checkpoint(page, "drawer-open", {
      atEachViewport: showSiteMenu,
      viewportOnly: true,
    });
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
    await expectTargetSizesAtLeast24(page, [360]);
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
    // One theme toggle per page: the header's, not a second in the drawer.
    await expect(drawer.getByRole("group", { name: "Theme" })).toBeHidden();
    await drawer.getByRole("button", { name: "Close menu" }).first().click();
    await expect(menu).toBeFocused();
  });

  test("at md the header search shows its whole placeholder", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await openHydrated(page);
    const field = page.getByRole("banner").getByRole("searchbox");
    const room = await field.evaluate((input: HTMLInputElement) => {
      const style = getComputedStyle(input);
      const context = document.createElement("canvas").getContext("2d");
      if (!context) return -1;
      context.font = style.font;
      const text = context.measureText(input.placeholder).width;
      const inner =
        input.clientWidth -
        Number.parseFloat(style.paddingLeft) -
        Number.parseFloat(style.paddingRight);
      return inner - text;
    });
    expect(room).toBeGreaterThanOrEqual(0);
  });

  test("from lg the header search says it searches the original wiki, until something is typed", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openHydrated(page);
    const banner = page.getByRole("banner");
    const hint = banner.getByTestId("search-long-placeholder");
    await expect(hint).toBeVisible();
    await expect(hint).toHaveText("Search the original wiki…");
    // The whole hint fits.
    expect(
      await hint.evaluate(element => element.scrollWidth <= element.clientWidth)
    ).toBe(true);
    await banner.getByRole("searchbox").fill("ballad");
    await expect(hint).toBeHidden();
    await page.setViewportSize({ width: 768, height: 1024 });
    await banner.getByRole("searchbox").fill("");
    await expect(hint).toBeHidden();
  });

  test("a short page fills the window: the footer at the bottom, nothing to scroll", async ({
    page,
  }) => {
    for (const viewport of [
      { width: 768, height: 1024 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await openHydrated(page, "/no-such-page");
      const footer = await page.getByRole("contentinfo").boundingBox();
      expect(footer).toBeTruthy();
      if (footer) {
        expect(
          Math.abs(footer.y + footer.height - viewport.height),
          `footer at the bottom at ${viewport.width}`
        ).toBeLessThan(SUB_PIXEL);
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollHeight)
      ).toBe(viewport.height);
    }
    // From lg the sheet hugs its content, rather than stretching empty.
    const main = page.getByRole("main");
    const last = main.getByRole("link", { name: /Look on the original wiki/ });
    const [mainBox, lastBox] = await Promise.all([
      main.boundingBox(),
      last.boundingBox(),
    ]);
    expect(mainBox && lastBox).toBeTruthy();
    if (mainBox && lastBox) {
      expect(
        mainBox.y + mainBox.height - (lastBox.y + lastBox.height)
      ).toBeLessThan(120);
    }
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

  test("following a sidebar link moves focus to the new page's content and announces it", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openHydrated(page, "/help/licence");
    const nav = page.getByRole("navigation", { name: "Site" });
    await nav.getByRole("link", { name: "FAQ for bards" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/help\/faq-for-bards$/);
    await expect(page.getByRole("main")).toBeFocused();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "FAQ for bards · Bardic Torch" })
    ).toHaveCount(1);
  });

  test("at 1280 × 800 the sidebar shows the current page, and says when there is more below", async ({
    page,
  }) => {
    await expectSidebarFold(page, () => Promise.resolve());
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
    // A stub build asks which fixture user to be.
    await page
      .getByRole("link", { name: /^Log in as the seeded contributor/ })
      .click();
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
    await expectTargetSizesAtLeast24(page, [1280]);
    await checkpoint(page, "account-open", {
      atEachViewport: openShownAccountPanel,
      viewportOnly: true,
    });
  });
});

test.describe("with wider text (0.15em more letter spacing) the shell's room holds", () => {
  // The wider text is an injected <style>, which the nonce CSP would block.
  test.use({ bypassCSP: true });

  test("below md the bar never covers the end of the page", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await openHydrated(page);
    await applyWiderText(page);
    await expectBarClearOfPageEnd(page);
  });

  test("at 1280 × 800 the sidebar shows the current page and the Help group, and says when there is more below", async ({
    page,
  }) => {
    const note = page
      .getByRole("navigation", { name: "Site" })
      .getByRole("paragraph")
      .first();
    const noteHeight = async () => (await note.boundingBox())?.height ?? 0;
    await page.setViewportSize({ width: 1280, height: 800 });
    await openHydrated(page, "/");
    const ownHeight = await noteHeight();
    let widenedHeight = 0;
    await expectSidebarFold(page, async () => {
      await applyWiderText(page);
      widenedHeight = await noteHeight();
    });
    // Not vacuous: the Browse note wraps to more lines than in the
    // machine's own sans (two more in the Playwright image).
    expect(widenedHeight).toBeGreaterThan(ownHeight);
  });
});

test.describe("text spacing (WCAG 1.4.12) on the shell and a help page", () => {
  // The override is an injected <style>, which the nonce CSP would block.
  test.use({ bypassCSP: true });

  test("the app bar, the header, the account panel and help prose keep all their text", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/auth/login?as=contributor&returnTo=/");
    await openHydrated(page);
    await applyTextSpacing(page);
    // Below md: the bottom app bar with its labelled cells, and its panel.
    await expectNothingCutOff(page, "header", "in the header at 360");
    await expectNothingCutOff(page, "main", "on the home page at 360");
    await openShownAccountPanel(page);
    const barPanel = await accountPanel(accountTrigger(appBar(page)));
    await expectNothingCutOff(
      page,
      `[id="${await barPanel.getAttribute("id")}"]`,
      "in the app bar's account panel"
    );
    await page.keyboard.press("Escape");
    // From md: the header's search, theme toggle and account control.
    for (const width of [768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await expectNothingCutOff(page, "header", `in the header at ${width}`);
    }
    await openShownAccountPanel(page);
    const headerPanel = await accountPanel(
      accountTrigger(page.getByRole("banner"))
    );
    await expectNothingCutOff(
      page,
      `[id="${await headerPanel.getAttribute("id")}"]`,
      "in the header's account panel"
    );
    await expectNoHorizontalOverflow(page);

    await page.setViewportSize(MOBILE);
    await openHydrated(page, "/help/contributing");
    await applyTextSpacing(page);
    await expectNothingCutOff(page, "main", "on a help page at 360");
    await expectNoHorizontalOverflow(page);
  });
});

test("in forced colours the shell's marked controls show focus, and button links keep an edge", async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await openHydrated(page, "/help/licence");
  const outline = (locator: Locator) =>
    locator.evaluate(element => {
      const style = getComputedStyle(element);
      return `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor} ${style.outlineOffset}`;
    });
  const marked = [
    page
      .getByRole("navigation", { name: "Site" })
      .getByRole("link", { name: "Licence & attribution" }),
    page.getByRole("banner").getByRole("button", { name: "System" }),
  ];
  for (const control of marked) {
    const resting = await outline(control);
    expect(resting, "the state mark").toMatch(/^solid /);
    await page.keyboard.press("Shift");
    await control.focus();
    expect(
      await control.evaluate(element => element.matches(":focus-visible"))
    ).toBe(true);
    const focusedOutline = await outline(control);
    expect(focusedOutline).toMatch(/^solid /);
    expect(focusedOutline, "focus differs from the state mark").not.toBe(
      resting
    );
  }
  const login = page.getByRole("banner").getByRole("link", { name: "Log in" });
  expect(
    await login.evaluate(element => {
      const style = getComputedStyle(element);
      return `${style.borderTopStyle} ${style.borderTopWidth}`;
    })
  ).toBe("solid 1px");
});
