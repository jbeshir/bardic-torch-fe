import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Runs `npm run dev:fixtures` for real: the fixture API and `react-router
 * dev` (the Vite dev server, with the Worker in workerd) with stub auth,
 * signed in through /auth/login with a cookie jar.
 * The script runs in its own process group so the test can stop exactly the
 * processes it started.
 */

const STARTUP_TIMEOUT_MS = 90_000;

let child: ChildProcess;
let output = "";
let origin = "";

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() =>
        typeof address === "object" && address
          ? resolve(address.port)
          : reject(new Error("no port"))
      );
    });
  });
}

/** The environment without vitest's markers, as a developer's shell has it. */
function developerEnv(): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) =>
        !/^VITEST/.test(name) && name !== "TEST" && name !== "NODE_ENV"
    )
  );
}

async function waitUntilReady(url: string): Promise<void> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`dev:fixtures exited early:\n${output}`);
    }
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`dev:fixtures did not start:\n${output}`);
}

async function stopProcessGroup(): Promise<void> {
  const pid = child.pid;
  if (pid === undefined || child.exitCode !== null) return;
  const exited = once(child, "exit");
  process.kill(-pid, "SIGTERM");
  const timeout = new Promise(resolve =>
    setTimeout(resolve, 10_000, "timeout")
  );
  if ((await Promise.race([exited, timeout])) === "timeout") {
    process.kill(-pid, "SIGKILL");
  }
}

/** A minimal cookie jar: name → value from Set-Cookie headers. */
const jar = new Map<string, string>();
function remember(response: Response) {
  for (const setCookie of response.headers.getSetCookie()) {
    const [pair = ""] = setCookie.split(";");
    const index = pair.indexOf("=");
    jar.set(pair.slice(0, index), pair.slice(index + 1));
  }
}
function cookieHeader(): string {
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

function patchMe(displayName: string, cookie: string) {
  return fetch(`${origin}/api/me`, {
    method: "PATCH",
    headers: {
      Origin: origin,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookie,
    },
    body: new URLSearchParams({ display_name: displayName }),
  });
}

beforeAll(async () => {
  const [devPort, fixturePort] = await Promise.all([freePort(), freePort()]);
  origin = `http://localhost:${devPort}`;
  child = spawn(process.execPath, ["scripts/dev-fixtures.mjs"], {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...developerEnv(),
      DEV_PORT: String(devPort),
      FIXTURE_API_PORT: String(fixturePort),
      NODE_ENV: "development",
    },
  });
  child.stdout?.on("data", chunk => (output += String(chunk)));
  child.stderr?.on("data", chunk => (output += String(chunk)));
  await waitUntilReady(`${origin}/`);
}, STARTUP_TIMEOUT_MS + 10_000);

afterAll(stopProcessGroup, 20_000);

describe("npm run dev:fixtures", () => {
  it("serves the app", async () => {
    const response = await fetch(`${origin}/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Bardic Torch");
  });

  it("shows the stub sign-in chooser at /auth/login: its process variables (AUTH_MODE) reach the Worker over .dev.vars", async () => {
    const response = await fetch(`${origin}/auth/login`, {
      redirect: "manual",
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("<h1>Choose a fixture user</h1>");
  });

  it("serves the styleguide (the development build mode)", async () => {
    const response = await fetch(`${origin}/styleguide`);
    expect(response.status).toBe(200);
  });

  it("signs in a fixture user with stub auth and the session reaches the fixture API", async () => {
    const login = await fetch(
      `${origin}/auth/login?as=moderator&returnTo=%2Fhelp`,
      { redirect: "manual" }
    );
    remember(login);

    expect(login.status).toBe(302);
    expect(login.headers.get("Location")).toBe("/help");
    expect(jar.has("__Host-bt_session")).toBe(true);

    const response = await patchMe("Master Tobias Fiddler", cookieHeader());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      data: {
        id: "fixture|moderator",
        display_name: "Master Tobias Fiddler",
        role: "moderator",
      },
    });
  });

  it("renders /settings for a signed-in fixture user from the fixture API (root /v1/me, settings /v1/tokens)", async () => {
    const login = await fetch(
      `${origin}/auth/login?as=contributor&returnTo=%2Fsettings`,
      { redirect: "manual" }
    );
    expect(login.status).toBe(302);
    const session = login.headers
      .getSetCookie()
      .map(value => value.split(";")[0] ?? "")
      .find(pair => pair.startsWith("__Host-bt_session="));
    expect(session).toBeDefined();

    const response = await fetch(`${origin}/settings`, {
      headers: { Cookie: session ?? "" },
    });
    expect(response.status).toBe(200);
    const html = await response.text();
    // The display name field holds the seeded name, and the token list has
    // the seeded tokens.
    expect(html).toMatch(/<input[^>]*value="Morwen of the Marches"/);
    expect(html).toContain("Laptop scripts");
    expect(html).toContain("Songbook importer");
    expect(html).not.toContain(
      "Log in to change your display name and manage your API tokens."
    );
  });

  it("refuses the same call without the session", async () => {
    const response = await patchMe("Master Tobias Fiddler", "");
    expect(response.status).toBe(401);
  });
});
