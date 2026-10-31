import { test as base, expect } from "@playwright/test";

/**
 * The Playwright `test` every spec uses. Its automatic network guard aborts
 * any browser request to a host other than this machine and fails the test
 * that made it, so journeys can never depend on, or leak to, the internet.
 */

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

export const test = base.extend<{ networkGuard: void }>({
  networkGuard: [
    async ({ context }, use) => {
      const blocked: string[] = [];
      await context.route("**/*", route => {
        const url = route.request().url();
        if (LOCAL_HOSTS.has(new URL(url).hostname)) return route.continue();
        blocked.push(url);
        return route.abort("blockedbyclient");
      });
      await use();
      expect(blocked, "requests to non-local hosts").toEqual([]);
    },
    { auto: true },
  ],
});
