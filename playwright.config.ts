import { defineConfig, devices } from "@playwright/test";

/**
 * `npm run test:e2e` builds the e2e build (stub sign-in compiled in) and runs
 * it with `wrangler dev` against the fixture API. `npm run screenshots` runs
 * the on-demand screenshots project instead.
 */

const FIXTURE_API_PORT = 4010;
const FIXTURE_API_URL = `http://127.0.0.1:${FIXTURE_API_PORT}`;
const PORT = 8788;
const BIND_IP = "127.0.0.1";
/**
 * Host the specs use; must be one the stub auth host lock accepts. It is
 * `localhost`, not 127.0.0.1: Playwright's request context only sends the
 * Secure session cookie over plain HTTP to `localhost`.
 */
const HOST = "localhost";
const BASE_URL = `http://${HOST}:${PORT}`;

const bindings = {
  BARDIC_TORCH_API_BASE_URL: FIXTURE_API_URL,
  AUTH_SESSION_SECRET: "e2e-session-secret-with-at-least-32-characters",
  AUTH0_DOMAIN: "auth0.invalid",
  AUTH0_CLIENT_ID: "e2e-client-id",
  AUTH0_CLIENT_SECRET: "e2e-client-secret",
  AUTH0_DEFAULT_REDIRECT_URI: BASE_URL,
  AUTH0_AUDIENCE: "e2e-audience",
  // Turnstile's test key; e2e/support/test.ts serves its script locally.
  TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  AUTH_MODE: "stub",
};

/**
 * Chromium resolves no host but this machine. The network guard in
 * e2e/support/test.ts fails a test on any other request, but a redirect's
 * next hop (e.g. /auth/logout's 302 to Auth0) never reaches a route
 * handler, so without this its DNS lookup would still leave the machine.
 */
const LOCAL_ONLY_RESOLVER = `--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE ${HOST}, EXCLUDE ${BIND_IP}`;

const browser = {
  ...devices["Desktop Chrome"],
  launchOptions: { args: [LOCAL_ONLY_RESOLVER] },
};

const bindingFlags = Object.entries(bindings)
  .map(([name, value]) => `--var ${name}:${value}`)
  .join(" ");

export default defineConfig({
  testDir: "./e2e",
  reporter: [["list"], ["html", { open: "never" }]],
  forbidOnly: true,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // One `wrangler dev` (a single workerd) serves every worker; with the
  // CPU-count default it drops requests. Four keeps runs stable.
  workers: 4,
  // One retry, for wrangler's own flakes (a POST in flight when workerd
  // restarts answers 503).
  retries: 1,
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  projects: [
    { name: "e2e", testIgnore: "screenshots.spec.ts", use: browser },
    { name: "screenshots", testMatch: "screenshots.spec.ts", use: browser },
  ],
  webServer: [
    {
      command: "npx tsx test/fixture-api/server.ts",
      url: `${FIXTURE_API_URL}/healthz`,
      env: { PORT: String(FIXTURE_API_PORT) },
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      // The build's own config (build/server/wrangler.json, through
      // .wrangler/deploy/config.json) sets the compatibility date and flags.
      // The Worker sees the real local origin, not the production one
      // wrangler would infer from wrangler.jsonc's routes: the stub auth
      // host lock and the same-origin checks compare against it. Only
      // these --var bindings apply.
      command:
        `npx wrangler dev --port ${PORT} --ip ${BIND_IP} --live-reload=false ` +
        `--show-interactive-dev-session=false --infer-origin-from-routes=false ` +
        bindingFlags,
      url: `http://${BIND_IP}:${PORT}`,
      timeout: 300_000,
      reuseExistingServer: false,
      // No network: skip wrangler's fetch of a sample `Request.cf` object.
      env: {
        WRANGLER_SEND_METRICS: "false",
        CLOUDFLARE_CF_FETCH_ENABLED: "false",
        CI: "1",
      },
    },
  ],
});
