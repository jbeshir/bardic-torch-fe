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
 *
 * Cloudflare Turnstile's script (the contact form) is the one exception:
 * the guard answers it with a stand-in, as the test site key behaves: its
 * widget puts the test token in the form at once.
 */

const TURNSTILE_SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js";

const TURNSTILE_STAND_IN = `window.turnstile = {
  render(container) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "cf-turnstile-response";
    input.value = "XXXX.DUMMY.TOKEN.XXXX";
    container.append(input);
    return "stand-in";
  },
  remove() {},
};`;

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
        if (!isOffHost(url) || url.href.startsWith(TURNSTILE_SCRIPT)) return;
        const expectedRedirect =
          request.redirectedFrom() !== null &&
          offHostRedirects.includes(url.hostname);
        if (!expectedRedirect) offHost.push(request.url());
      };
      context.on("request", record);
      await context.route("**/*", route => {
        const url = route.request().url();
        if (url.startsWith(TURNSTILE_SCRIPT)) {
          return route.fulfill({
            contentType: "text/javascript",
            body: TURNSTILE_STAND_IN,
          });
        }
        return LOCAL_HOSTS.has(new URL(url).hostname)
          ? route.continue()
          : route.abort("blockedbyclient");
      });
      await use();
      context.off("request", record);
      expect(offHost, "requests to non-local hosts").toEqual([]);
    },
    { auto: true },
  ],
});
