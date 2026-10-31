import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `npm run dev:fixtures`: the fixture API plus `remix vite:dev` pointed at it
 * with stub auth on, so the app runs without Auth0 or a backend. Sign in at
 * http://localhost:5173/auth/login?as=contributor (or `moderator`, or a user
 * created with `POST /__fixtures/users`).
 *
 * Ports: DEV_PORT (default 5173) and FIXTURE_API_PORT (default 4010). Ctrl-C
 * or SIGTERM stops both; if either exits, the other is stopped too.
 */

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const bin = name => path.join(ROOT, "node_modules/.bin", name);

const devPort = process.env.DEV_PORT ?? "5173";
const fixturePort = process.env.FIXTURE_API_PORT ?? "4010";

/** Variables vite.config.ts lays over .dev.vars for the dev server. */
const appEnv = {
  BARDIC_TORCH_API_BASE_URL: `http://127.0.0.1:${fixturePort}`,
  AUTH_MODE: "stub",
  AUTH_SESSION_SECRET: "dev-fixtures-session-secret-not-for-real-use",
  AUTH0_DOMAIN: "auth0.invalid",
  AUTH0_CLIENT_ID: "dev-fixtures",
  AUTH0_CLIENT_SECRET: "dev-fixtures",
  AUTH0_DEFAULT_REDIRECT_URI: `http://localhost:${devPort}`,
  AUTH0_AUDIENCE: "dev-fixtures",
};

const children = [
  spawn(bin("tsx"), ["test/fixture-api/server.ts"], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, PORT: fixturePort },
  }),
  spawn(bin("remix"), ["vite:dev", "--port", devPort, "--strictPort"], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...appEnv },
  }),
];

let stopping = false;
function stop(exitCode) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) {
    if (child.exitCode === null) child.kill("SIGTERM");
  }
}

for (const child of children) {
  child.on("exit", code => stop(code ?? 1));
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
