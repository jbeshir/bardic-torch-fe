import { test as base, expect, type Request } from "@playwright/test";

/**
 * The Playwright `test` every spec uses. Its automatic network guard aborts
 * any browser request to a host other than this machine and fails the test
 * that made it, so journeys can never depend on, or leak to, the internet.
 *
 * A redirect's next hop never reaches a route handler (Playwright only
 * routes the first URL of a redirect chain), so the guard records from the
 * context's `request` event, which every hop raises; Chromium can't resolve
 * a non-local host anyway (see `LOCAL_ONLY_RESOLVER` in the config). A test
 * that expects to be redirected off this machine, like logout to Auth0,
 * names that host in `offHostRedirects` and asserts the hop itself.
 */

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

function isOffHost(url: URL): boolean {
  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    !LOCAL_HOSTS.has(url.hostname)
  );
}

export const test = base.extend<{
  offHostRedirects: readonly string[];
  networkGuard: void;
}>({
  offHostRedirects: [[], { option: true }],
  networkGuard: [
    async ({ context, offHostRedirects }, use) => {
      const offHost: string[] = [];
      const record = (request: Request) => {
        const url = new URL(request.url());
        if (!isOffHost(url)) return;
        const expectedRedirect =
          request.redirectedFrom() !== null &&
          offHostRedirects.includes(url.hostname);
        if (!expectedRedirect) offHost.push(request.url());
      };
      context.on("request", record);
      await context.route("**/*", route =>
        LOCAL_HOSTS.has(new URL(route.request().url()).hostname)
          ? route.continue()
          : route.abort("blockedbyclient")
      );
      await use();
      context.off("request", record);
      expect(offHost, "requests to non-local hosts").toEqual([]);
    },
    { auto: true },
  ],
});
