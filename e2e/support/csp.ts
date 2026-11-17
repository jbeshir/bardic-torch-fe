import type { Page } from "@playwright/test";

/**
 * Collects the page's Content Security Policy violations, as Chromium
 * reports them on the console, from now on. The returned array fills as
 * the page runs; assert it is empty at the end.
 */
export function collectCspViolations(page: Page): readonly string[] {
  const violations: string[] = [];
  page.on("console", message => {
    if (message.text().includes("Content Security Policy")) {
      violations.push(message.text());
    }
  });
  return violations;
}
