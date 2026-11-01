import { defineConfig, devices } from "@playwright/test";
import { FIXTURE_API_PORT, FIXTURE_API_URL } from "./e2e/support/fixture-api";

/**
 * One e2e phase per run, chosen by E2E_PHASE (`npm run test:e2e` runs both
 * in turn; see scripts/e2e.mjs). Both phases serve their build with
 * `wrangler pages dev` against the fixture API, with AUTH_MODE=stub bound:
 * - prod: `npm run build`, the real production build (stub auth absent);
 * - stub: `npm run build:e2e`, with stub sign-in for the login journeys.
 */

const PHASES = {
  prod: "npm run build",
  stub: "npm run build:e2e",
} as const;

const PORT = 8788;
const BIND_IP = "127.0.0.1";
/**
 * Host the specs use; must be one the stub auth host lock accepts. It is
 * `localhost`, not 127.0.0.1: Playwright's request context only sends the
 * Secure session cookie over plain HTTP to `localhost` (Chromium accepts
 * both), so `page.request` calls would otherwise go out signed out.
 */
const HOST = "localhost";
const BASE_URL = `http://${HOST}:${PORT}`;
const COMPATIBILITY_DATE = "2024-05-12";

const requestedPhase = process.env.E2E_PHASE ?? "prod";
if (!(requestedPhase in PHASES)) {
  throw new Error(
    `E2E_PHASE must be one of ${Object.keys(PHASES).join(", ")}, not ${requestedPhase}`
  );
}
const phase = requestedPhase as keyof typeof PHASES;

const bindings = {
  BARDIC_TORCH_API_BASE_URL: FIXTURE_API_URL,
  AUTH_SESSION_SECRET: "e2e-session-secret-with-at-least-32-characters",
  AUTH0_DOMAIN: "auth0.invalid",
  AUTH0_CLIENT_ID: "e2e-client-id",
  AUTH0_CLIENT_SECRET: "e2e-client-secret",
  AUTH0_DEFAULT_REDIRECT_URI: BASE_URL,
  AUTH0_AUDIENCE: "e2e-audience",
  AUTH_MODE: "stub",
};

const bindingFlags = Object.entries(bindings)
  .map(([name, value]) => `--binding ${name}=${value}`)
  .join(" ");

export default defineConfig({
  outputDir: `./test-results/${phase}`,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: `./playwright-report/${phase}` }],
  ],
  metadata: { phase },
  forbidOnly: true,
  timeout: 90_000,
  /**
   * One wrangler (workerd) process serves every worker, and each worker runs
   * axe and full-page screenshots; with the CPU-count default (10 here) workerd
   * drops requests and checkpoints time out. Four keeps runs stable.
   */
  workers: 4,
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: phase,
      testDir: `./e2e/${phase}`,
      teardown: "screenshots",
      use: { ...devices["Desktop Chrome"] },
    },
    { name: "screenshots", testDir: "./e2e", testMatch: "global-teardown.ts" },
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
      command:
        `${PHASES[phase]} && ` +
        `npx wrangler pages dev build/client --port ${PORT} --ip ${BIND_IP} ` +
        `--compatibility-date=${COMPATIBILITY_DATE} ${bindingFlags}`,
      url: `http://${BIND_IP}:${PORT}`,
      timeout: 300_000,
      reuseExistingServer: false,
      env: { WRANGLER_SEND_METRICS: "false", CI: "1" },
    },
  ],
});
