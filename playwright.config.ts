import { defineConfig, devices } from "@playwright/test";

const PORT = 8788;
// wrangler binds the loopback address; the browser and Playwright's request
// context use `localhost`, because Playwright only sends `Secure` cookies over
// plain http when the host is `localhost`.
const BIND_ADDRESS = "127.0.0.1";
const BASE_URL = `http://localhost:${PORT}`;
// The newest date supported by wrangler 3.57.1's workerd; keep in step with
// wrangler.toml. Passing it explicitly avoids resolving it over the network.
const COMPATIBILITY_DATE = "2024-05-12";

const bindings = {
  BARDIC_TORCH_API_BASE_URL: "http://127.0.0.1:4010",
  AUTH_SESSION_SECRET: "e2e-session-secret-with-at-least-32-characters",
  AUTH0_DOMAIN: "auth0.invalid",
  AUTH0_CLIENT_ID: "e2e-client-id",
  AUTH0_CLIENT_SECRET: "e2e-client-secret",
  AUTH0_DEFAULT_REDIRECT_URI: BASE_URL,
  AUTH0_AUDIENCE: "e2e-audience",
};

const bindingFlags = Object.entries(bindings)
  .map(([name, value]) => `--binding ${name}=${value}`)
  .join(" ");

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      "npm run build && " +
      `npx wrangler pages dev build/client --port ${PORT} --ip ${BIND_ADDRESS} ` +
      `--compatibility-date=${COMPATIBILITY_DATE} ${bindingFlags}`,
    url: `http://${BIND_ADDRESS}:${PORT}`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: { WRANGLER_SEND_METRICS: "false", CI: "1" },
  },
});
