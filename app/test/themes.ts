import { cleanup } from "@testing-library/react";
import { expect } from "vitest";

const THEMES = ["light", "dark"] as const;

/**
 * Renders the same UI with `data-theme="light"` and then `"dark"` on the
 * document root and expects identical markup: colours come only from token
 * classes, whose values the theme swaps in CSS (DESIGN §9.2), so nothing in
 * the DOM may depend on the theme.
 *
 * A guard, not theme coverage: it can only fail if a component starts
 * branching on the theme, and proves nothing about how either theme looks.
 * That evidence is check:contrast (every token pair in both themes) and the
 * e2e checkpoints (axe and screenshots per theme, each asserting the page
 * paints that theme's canvas; docs/TESTING.md).
 */
export async function expectSameMarkupInBothThemes(
  renderUi: () => unknown
): Promise<void> {
  const markup: string[] = [];
  for (const theme of THEMES) {
    document.documentElement.dataset.theme = theme;
    await renderUi();
    // useId() counts up across renders; the ids differ but aren't styling.
    // React 19 writes them as `_r_7_`.
    markup.push(document.body.innerHTML.replace(/_r_[0-9a-z]+_/g, "_id_"));
    cleanup();
  }
  document.documentElement.removeAttribute("data-theme");
  expect(markup[0]).toContain("class=");
  expect(markup[1]).toBe(markup[0]);
  expect(markup[0]).not.toMatch(/\bdark:/);
}
