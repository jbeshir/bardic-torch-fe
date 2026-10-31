import { cleanup } from "@testing-library/react";
import { expect } from "vitest";

const THEMES = ["light", "dark"] as const;

/**
 * Renders the same UI with `data-theme="light"` and then `"dark"` on the
 * document root and expects identical markup: colours come only from token
 * classes, whose values the theme swaps in CSS (DESIGN §9.2), so nothing in
 * the DOM may depend on the theme.
 */
export async function expectSameMarkupInBothThemes(
  renderUi: () => unknown
): Promise<void> {
  const markup: string[] = [];
  for (const theme of THEMES) {
    document.documentElement.dataset.theme = theme;
    await renderUi();
    // useId() counts up across renders; the ids differ but aren't styling.
    markup.push(document.body.innerHTML.replace(/:r[0-9a-z]+:/g, ":id:"));
    cleanup();
  }
  document.documentElement.removeAttribute("data-theme");
  expect(markup[0]).toContain("class=");
  expect(markup[1]).toBe(markup[0]);
  expect(markup[0]).not.toMatch(/\bdark:/);
}
