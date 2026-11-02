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

/**
 * Waits until no finite CSS transition or animation is running in the
 * page. A checkpoint changes styles just before axe: the theme switch
 * (every `transition-colors` element, such as a linked card, eases from
 * the old theme's colours to the new one's), a resize, focus or hover set
 * by `atEachViewport`, the pointer moved away, or forced colours turned
 * off. Axe reads computed colours, so mid-transition it would measure a
 * blend that is never at rest on the page. Infinite ones (spinners,
 * skeleton shimmer) never finish and don't change colour pairs, so they
 * are left running. `getAnimations()` flushes pending style changes, so a
 * transition the last change starts is already listed; one that a
 * finishing animation starts is caught by the next pass.
 */
async function stylesSettled(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const running = () =>
      document
        .getAnimations()
        .filter(
          animation =>
            animation.playState === "running" &&
            Number.isFinite(
              Number(animation.effect?.getComputedTiming().endTime)
            )
        );
    for (let now = running(); now.length > 0; now = running()) {
      await Promise.allSettled(now.map(({ finished }) => finished));
    }
  });
}

async function expectNoAxeViolations(
  page: Page,
  label: string,
  target: string | undefined
) {
  await stylesSettled(page);
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
 * Runs `check` on the page in its author colours. Under emulated forced
 * colours Chromium paints text in the system palette, but getComputedStyle
 * reports the author `color` next to the forced `background-color`, and axe
 * has no forced-colours mode. So its contrast rule would compare two colours
 * that are never painted together (a primary button's `accent-fg` text on
 * the system Canvas: 1.02:1, while the button is drawn black on white). A
 * page in forced colours has them turned off for the check, so every rule
 * runs on the same DOM, focus and theme, with contrast measured as FE1's
 * checkpoints measure it, and turned back on before the screenshot.
 */
async function inAuthorColours(
  page: Page,
  check: () => Promise<void>
): Promise<void> {
  const forced = await page.evaluate(
    () => matchMedia("(forced-colors: active)").matches
  );
  if (!forced) {
    await check();
    return;
  }
  await page.emulateMedia({ forcedColors: "none" });
  try {
    await check();
  } finally {
    await page.emulateMedia({ forcedColors: "active" });
  }
}

/** Room around an element screenshot, so an outset focus ring shows whole. */
const ELEMENT_SHOT_PAD = 8;

/**
 * An element screenshot, taken from the viewport with the element wholly
 * inside it: Chromium paints what lies beyond the viewport as bare canvas
 * (a band across the foot of a tall block at 1280 × 800), so the element
 * is scrolled to the top and, if it is still taller, the viewport is made
 * taller for the shot. The shell header (and the app bar inside it) is not
 * painted, so it never covers the specimen. Styles are set through the
 * CSSOM: the nonce CSP blocks the <style> that the screenshot's own
 * `style` option would inject.
 */
async function elementShot(page: Page, target: string, file: string) {
  const viewport = page.viewportSize();
  const hideChrome = (hidden: boolean) =>
    page.evaluate(value => {
      for (const header of document.querySelectorAll("header")) {
        header.style.visibility = value ? "hidden" : "";
      }
    }, hidden);
  const element = page.locator(target);
  const place = () =>
    element.evaluate(node => {
      node.scrollIntoView({ block: "start", behavior: "instant" });
      const { bottom } = node.getBoundingClientRect();
      return Math.ceil(bottom);
    });
  await hideChrome(true);
  try {
    const bottom = await place();
    if (viewport && bottom + ELEMENT_SHOT_PAD > viewport.height) {
      await page.setViewportSize({
        width: viewport.width,
        height: bottom + ELEMENT_SHOT_PAD,
      });
      await place();
    }
    const box = await element.boundingBox();
    const size = page.viewportSize();
    if (!box || !size) throw new Error(`${target} is not laid out`);
    const left = Math.max(0, Math.floor(box.x) - ELEMENT_SHOT_PAD);
    const top = Math.max(0, Math.floor(box.y) - ELEMENT_SHOT_PAD);
    const right = Math.min(
      size.width,
      Math.ceil(box.x + box.width) + ELEMENT_SHOT_PAD
    );
    const foot = Math.min(
      size.height,
      Math.ceil(box.y + box.height) + ELEMENT_SHOT_PAD
    );
    expect(
      box.y + box.height,
      `${target} fits the viewport for its screenshot`
    ).toBeLessThanOrEqual(size.height);
    await page.screenshot({
      path: file,
      animations: "disabled",
      clip: { x: left, y: top, width: right - left, height: foot - top },
    });
  } finally {
    await hideChrome(false);
    if (viewport) await page.setViewportSize(viewport);
  }
}

/**
 * A full-page screenshot as the page reads from its top: scrolled back
 * there first, so the sticky header is drawn at the top of the image and
 * not over whatever the page was scrolled to (a field's inline error).
 */
async function fullPageShot(page: Page, file: string) {
  await page.evaluate(() =>
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
  );
  await page.screenshot({ path: file, fullPage: true, animations: "disabled" });
}

/**
 * Shows the page in its web fonts, as on any visit after the first. The
 * site's @font-face rules use `font-display: optional`: on a cold load a
 * page whose Fraunces arrives late keeps the fallback serif for its whole
 * life, by design, so captures would differ by timing alone. Here each
 * optional face is fetched and added again from JS with `display: block`
 * (same file, same descriptors), then every font load is awaited.
 */
async function fontsLoaded(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const marker = "data-e2e-fonts-blocked";
    const root = document.documentElement;
    if (!root.hasAttribute(marker)) {
      root.setAttribute(marker, "");
      const rules = [...document.styleSheets].flatMap(sheet =>
        [...sheet.cssRules].filter(
          (rule): rule is CSSFontFaceRule => rule instanceof CSSFontFaceRule
        )
      );
      await Promise.all(
        rules
          .filter(
            rule => rule.style.getPropertyValue("font-display") === "optional"
          )
          .map(async rule => {
            const url = /url\(["']?([^"')]+)["']?\)/.exec(
              rule.style.getPropertyValue("src")
            )?.[1];
            if (!url) return;
            const data = await (await fetch(url)).arrayBuffer();
            const face = new FontFace(
              rule.style.getPropertyValue("font-family").replaceAll('"', ""),
              data,
              {
                style: rule.style.getPropertyValue("font-style") || "normal",
                weight: rule.style.getPropertyValue("font-weight") || "normal",
                unicodeRange:
                  rule.style.getPropertyValue("unicode-range") || "U+0-10FFFF",
                display: "block",
              }
            );
            document.fonts.add(await face.load());
          })
      );
    }
    await document.fonts.ready;
  });
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
 * Axe runs once the page's transitions have finished (`stylesSettled`).
 * A page in emulated forced colours is checked by axe in its author
 * colours and captured in forced colours (see `inAuthorColours`).
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
    readonly atEachViewport?: ((page: Page) => Promise<void>) | undefined;
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
          await inAuthorColours(page, () =>
            expectNoAxeViolations(
              page,
              `${theme} at ${viewport.width}px`,
              target
            )
          );
        }
        await page.mouse.move(0, 0);
        await fontsLoaded(page);
        const file = path.join(
          SCREENSHOT_DIR,
          screenshotName(journey, name, theme, viewport)
        );
        if (target && !viewportOnly) {
          await elementShot(page, target, file);
        } else if (viewportOnly) {
          await page.screenshot({ path: file, animations: "disabled" });
        } else {
          await fullPageShot(page, file);
        }
      }
    }
    if (original) await restoreTheme(page, original);
  });
  if (originalViewport) await page.setViewportSize(originalViewport);
}
