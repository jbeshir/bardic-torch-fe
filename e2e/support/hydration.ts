import { expect, type Page } from "@playwright/test";

/**
 * How long a page may take to hydrate. Hydration is a precondition, not
 * the behaviour under test, and under a loaded run (four workers, each
 * running axe and full-page screenshots against one workerd) the big
 * styleguide page took more than 5 s after `load` to hydrate, with every
 * script already downloaded.
 */
const HYDRATION_TIMEOUT = 30_000;

/**
 * Resolves once the shell page has hydrated, so JS behaviour (Escape
 * handlers, the enhanced Tabs, the Menu drawer, the optimistic theme
 * switch) is wired up before a test drives it. Call it after every
 * document load: `goto`, `reload`, or a click that does a full navigation
 * (stub sign-in redirects).
 *
 * Two signals: React Router's client router exists, and the shell's Menu buttons
 * (the header's and the app bar's) are rendered. They only exist once
 * `useHydrated` turns true, in the re-render React schedules after the
 * hydration commit, so every event handler in the page is attached by
 * then. Pages under the root error boundary have no shell, so this is not
 * for them.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(
    () => "__reactRouterDataRouter" in window,
    undefined,
    {
      timeout: HYDRATION_TIMEOUT,
    }
  );
  await expect(
    page.locator('header button[aria-haspopup="dialog"]')
  ).toHaveCount(2, { timeout: HYDRATION_TIMEOUT });
}
