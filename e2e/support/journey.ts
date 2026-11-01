import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Cookie, type Page } from "@playwright/test";
import path from "node:path";
import {
  AXE_WIDTHS,
  CHECKPOINTS,
  SCREENSHOT_DIR,
  screenshotName,
  THEMES,
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
 * A visual and accessibility checkpoint of the current page: zero axe
 * violations in light and dark at 360 and 1280 px wide, and a full-page
 * screenshot per theme and viewport in e2e/screenshots. With `target` (a
 * CSS selector, e.g. one styleguide block or an open dialog), axe and the
 * screenshot cover that element only. The name must be declared for this
 * journey in support/checkpoints.ts.
 *
 * It marks its test slow: four axe runs and six full-page screenshots of
 * a long page take 60–90 s on a loaded runner (see the C6 e2e traces), the
 * whole default timeout. Tests should keep other sweeps out of the test
 * that takes the checkpoint.
 */
export async function checkpoint(
  page: Page,
  name: string,
  { target }: { readonly target?: string } = {}
): Promise<void> {
  const info = test.info();
  const phase = info.project.name as Phase;
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
    for (const theme of THEMES) {
      const before = await applyTheme(page, theme);
      original ??= before;
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        if (AXE_WIDTHS.includes(viewport.width)) {
          await expectNoAxeViolations(
            page,
            `${theme} at ${viewport.width}px`,
            target
          );
        }
        const file = path.join(
          SCREENSHOT_DIR,
          screenshotName(journey, name, theme, viewport)
        );
        await (target
          ? page
              .locator(target)
              .screenshot({ path: file, animations: "disabled" })
          : page.screenshot({
              path: file,
              fullPage: true,
              animations: "disabled",
            }));
      }
    }
    if (original) await restoreTheme(page, original);
  });
  if (originalViewport) await page.setViewportSize(originalViewport);
}
