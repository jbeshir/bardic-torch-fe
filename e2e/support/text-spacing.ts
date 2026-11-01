import { expect, type Page } from "@playwright/test";
import { findCutOffControls } from "./cut-off";

/**
 * WCAG 1.4.12 text spacing: the bookmarklet's override (line height 1.5,
 * letter 0.12em, word 0.16em, paragraphs 2em apart). It is an injected
 * <style>, which the nonce CSP blocks: specs using it set
 * `test.use({ bypassCSP: true })`.
 */
export async function applyTextSpacing(page: Page): Promise<void> {
  await page.addStyleTag({
    content:
      "* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } " +
      "p { margin-bottom: 2em !important; }",
  });
}

/**
 * Under the override (applyTextSpacing), at the current width: no element
 * under `rootSelector` that clips (overflow hidden or clip) has more
 * content than room, and every link and button keeps its content inside
 * (findCutOffControls). Visually hidden helpers, closed dialogs and form
 * controls (which scroll their own value) aren't clipped text.
 */
export async function expectNothingCutOff(
  page: Page,
  rootSelector: string,
  label: string
): Promise<void> {
  const clipped = await page.evaluate(selector => {
    const problems: string[] = [];
    for (const root of document.querySelectorAll(selector)) {
      for (const element of root.querySelectorAll<HTMLElement>("*")) {
        if (
          !(element instanceof HTMLElement) ||
          element.matches("input, select, textarea") ||
          element.closest("[aria-hidden='true'], .sr-only, dialog:not([open])")
        ) {
          continue;
        }
        const style = getComputedStyle(element);
        const clips = [style.overflowX, style.overflowY].some(value =>
          ["hidden", "clip"].includes(value)
        );
        if (!clips) continue;
        if (
          element.scrollWidth > element.clientWidth + 1 ||
          element.scrollHeight > element.clientHeight + 1
        ) {
          problems.push(
            `${element.tagName.toLowerCase()} "${(element.textContent ?? "").trim().slice(0, 40)}"`
          );
        }
      }
    }
    return problems;
  }, rootSelector);
  expect(clipped, `clipped ${label}`).toEqual([]);
  const cutOff = await page.evaluate(findCutOffControls, rootSelector);
  expect(cutOff, `controls cut off ${label}`).toEqual([]);
}
