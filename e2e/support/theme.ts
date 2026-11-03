import { expect, type Page } from "@playwright/test";
import {
  channelString,
  resolveColour,
  type Theme,
} from "../../app/styles/tokens";

/** Reading the page's theme, for prod/theme.spec.ts and prod/no-js.spec.ts. */

const THEME_COOKIE = "theme";

/** The canvas token's channels, as the CSS custom property holds them. */
export function canvas(theme: Theme): string {
  return channelString(resolveColour(theme, "canvas"));
}

/** What the page shows: the --bt-canvas value and the painted background. */
export async function rendered(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    return {
      attribute: root.getAttribute("data-theme"),
      canvas: style.getPropertyValue("--bt-canvas").trim(),
      // The painted colour's numbers ("22 18 14"), to compare with the token.
      background: (style.backgroundColor.match(/\d+/g) ?? []).join(" "),
    };
  });
}

/** The page has painted `theme`'s canvas (polled: a switch can be in flight). */
export async function expectRenderedTheme(page: Page, theme: Theme) {
  await expect
    .poll(async () => {
      const { canvas: value, background } = await rendered(page);
      return { canvas: value, background };
    })
    .toEqual({ canvas: canvas(theme), background: canvas(theme) });
}

/** The `theme` cookie the browser holds, if any. */
export async function themeCookie(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.find(({ name }) => name === THEME_COOKIE);
}
