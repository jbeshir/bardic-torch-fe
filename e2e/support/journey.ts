import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Cookie, type Page } from "@playwright/test";
import path from "node:path";
import { channelString, resolveColour } from "../../app/styles/tokens";
import {
  AXE_WIDTHS,
  CHECKPOINTS,
  checkpointThemes,
  SCREENSHOT_DIR,
  screenshotName,
  VIEWPORTS,
  type Phase,
  type Theme,
} from "./checkpoints";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const THEME_COOKIE = "theme";

type ThemeState = {
  readonly cookie: Cookie | undefined;
  readonly attribute: string | null;
};

/**
 * Show the page in `theme` the way the site does for a reader who chose it:
 * the `theme` cookie (so later navigations render it server-side), the
 * `data-theme` attribute on <html> (what the toggle sets straight away,
 * without a reload that would lose the page's state) and a matching OS
 * preference, so nothing disagrees. Returns what to restore afterwards.
 */
async function applyTheme(page: Page, theme: Theme): Promise<ThemeState> {
  const context = page.context();
  const url = new URL(page.url()).origin;
  const before: ThemeState = {
    cookie: (await context.cookies(url)).find(
      ({ name }) => name === THEME_COOKIE
    ),
    attribute: await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme")
    ),
  };
  await context.addCookies([{ name: THEME_COOKIE, value: theme, url }]);
  await page.emulateMedia({ colorScheme: theme });
  await page.evaluate(setThemeAttribute, theme);
  return before;
}

async function restoreTheme(page: Page, state: ThemeState): Promise<void> {
  const context = page.context();
  await context.clearCookies({ name: THEME_COOKIE });
  if (state.cookie) await context.addCookies([state.cookie]);
  await page.evaluate(setThemeAttribute, state.attribute);
  await page.emulateMedia({ colorScheme: null });
}

/** Runs in the page: show `theme`, or follow the device for null. */
function setThemeAttribute(theme: string | null) {
  const root = document.documentElement;
  if (theme === null) root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  document
    .querySelector('meta[name="color-scheme"]')
    ?.setAttribute("content", theme ?? "light dark");
}

async function expectNoAxeViolations(
  page: Page,
  label: string,
  target: string | undefined
) {
  const builder = new AxeBuilder({ page }).withTags(AXE_TAGS);
  const { violations } = await (
    target ? builder.include(target) : builder
  ).analyze();
  const summary = violations.map(
    ({ id, impact, help, nodes }) =>
      `${id} (${impact ?? "unknown"}): ${help}\n` +
      nodes.map(node => `    ${node.target.join(" ")}`).join("\n")
  );
  expect(summary, `axe violations, ${label}`).toEqual([]);
}

/**
 * During an element screenshot the shell header (and the app bar inside
 * it) is not painted: Playwright stitches a tall element from scrolled
 * captures, and the sticky header and the fixed bar would otherwise be
 * drawn over the specimen mid-image. Viewport and full-page captures keep
 * them, since there they are part of the page as a reader sees it. Set
 * through the CSSOM: the nonce CSP blocks the <style> that the
 * screenshot's own `style` option would inject.
 */
async function elementShot(page: Page, target: string, file: string) {
  const hideChrome = (hidden: boolean) =>
    page.evaluate(value => {
      for (const header of document.querySelectorAll("header")) {
        header.style.visibility = value ? "hidden" : "";
      }
    }, hidden);
  await hideChrome(true);
  try {
    await page
      .locator(target)
      .screenshot({ path: file, animations: "disabled" });
  } finally {
    await hideChrome(false);
  }
}

/** The `canvas` token the page paints in, as `r g b`. */
async function renderedCanvas(page: Page): Promise<string> {
  return page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--canvas")
      .trim()
  );
}

/**
 * A visual and accessibility checkpoint of the current page: zero axe
 * violations at 360 and 1280 px wide, and a full-page screenshot per
 * viewport in e2e/screenshots, in light and dark (or in the themes
 * `checkpointThemes` gives for a state only one theme can reach). Before
 * each capture it checks the page really paints that theme's canvas, and
 * moves the pointer to the corner, so no hover left by an earlier click
 * shows (hover states can't be captured statically; DESIGN §10.6).
 *
 * With `target` (a CSS selector, e.g. one styleguide block or an open
 * dialog), axe and the screenshot cover that element only; with `target`
 * and `viewportOnly`, axe covers the element and the screenshot is the
 * viewport (an open dialog with its scrim, toasts where they appear).
 * The name must be declared for this journey in support/checkpoints.ts.
 *
 * A state that lives in a width-specific control (the account panel is the
 * header's from md and the app bar's below; the drawer becomes the sidebar
 * at lg) passes `atEachViewport`, which brings the state back at each
 * width before axe and the screenshot, and usually `viewportOnly`: a
 * full-page capture stretches the viewport to the page, which drops fixed
 * sheets and panels to the bottom of a tall image.
 *
 * It marks its test slow: four axe runs and six full-page screenshots of
 * a long page take 60–90 s on a loaded runner (see the C6 e2e traces), the
 * whole default timeout. Tests should keep other sweeps out of the test
 * that takes the checkpoint.
 */
export async function checkpoint(
  page: Page,
  name: string,
  {
    target,
    atEachViewport,
    viewportOnly = false,
  }: {
    readonly target?: string;
    readonly atEachViewport?: (page: Page) => Promise<void>;
    readonly viewportOnly?: boolean;
  } = {}
): Promise<void> {
  const info = test.info();
  // The phase, not the project: a phase's no-JS project shares its list.
  const phase = info.config.metadata.phase as Phase;
  const journey = path.basename(info.file, ".spec.ts");
  if (!CHECKPOINTS[phase]?.[journey]?.includes(name)) {
    throw new Error(
      `Checkpoint "${name}" of journey "${journey}" (${phase}) is not declared in e2e/support/checkpoints.ts`
    );
  }

  test.slow();
  const originalViewport = page.viewportSize();
  await test.step(`checkpoint ${journey}/${name}`, async () => {
    let original: ThemeState | undefined;
    for (const theme of checkpointThemes(journey, name)) {
      const before = await applyTheme(page, theme);
      original ??= before;
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        if (atEachViewport) await atEachViewport(page);
        expect(await renderedCanvas(page), `${theme} canvas`).toBe(
          channelString(resolveColour(theme, "canvas"))
        );
        if (AXE_WIDTHS.includes(viewport.width)) {
          await expectNoAxeViolations(
            page,
            `${theme} at ${viewport.width}px`,
            target
          );
        }
        await page.mouse.move(0, 0);
        const file = path.join(
          SCREENSHOT_DIR,
          screenshotName(journey, name, theme, viewport)
        );
        await (target && !viewportOnly
          ? elementShot(page, target, file)
          : page.screenshot({
              path: file,
              fullPage: !viewportOnly,
              animations: "disabled",
            }));
      }
    }
    if (original) await restoreTheme(page, original);
  });
  if (originalViewport) await page.setViewportSize(originalViewport);
}
