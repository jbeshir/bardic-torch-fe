import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testEnv } from "~/test/context";
import worker from "../workers/app";

// workers/app.ts, the module Cloudflare actually runs, wired to a build
// whose only route counts its calls. An invalid environment must be
// answered with the static 500 page before React Router (and so any
// loader) runs.

const probe = vi.hoisted(() => ({
  loader: vi.fn(() => new Response("probe", { status: 200 })),
}));

// A mocked module must define every export React Router reads, so the
// build's optional exports are spelled out.
vi.mock("virtual:react-router/server-build", async () => {
  const { testBuild } = await import("~/test/server-build");
  const build = testBuild([
    {
      id: "routes/probe",
      path: "probe",
      module: { loader: probe.loader },
      hasLoader: true,
    },
  ]);
  return {
    ...build,
    basename: undefined,
    allowedActionOrigins: undefined,
    unstable_apiOnly: undefined,
    unstable_apiServerOrigin: undefined,
    unstable_getCriticalCss: undefined,
  };
});

const ENV = testEnv();
const PROBE = "https://app.test/probe";

/** Call the Worker the way Cloudflare does, with `env` as its bindings. */
async function call(request: Request, env: Readonly<Record<string, unknown>>) {
  const waiting: Promise<unknown>[] = [];
  const response = await worker.fetch?.(
    request as Parameters<NonNullable<typeof worker.fetch>>[0],
    // Cloudflare hands the Worker whatever is configured, valid or not.
    env as unknown as Env,
    {
      waitUntil: (promise: Promise<unknown>) => waiting.push(promise),
      passThroughOnException: () => undefined,
      props: {},
    } as unknown as ExecutionContext
  );
  await Promise.all(waiting);
  if (!response) throw new Error("The Worker answered nothing");
  return response;
}

beforeEach(() => {
  vi.stubGlobal("__DEV_ENV_OVERRIDES__", {});
  probe.loader.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("workers/app.ts", () => {
  it("serves the build's routes with a valid environment", async () => {
    const response = await call(new Request(PROBE), { ...ENV });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("probe");
    expect(probe.loader).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["no bindings at all", {}],
    ["a short session secret", { ...ENV, AUTH_SESSION_SECRET: "short" }],
    [
      "a placeholder API URL",
      { ...ENV, BARDIC_TORCH_API_BASE_URL: "replace-with-the-api-url" },
    ],
    ["an unknown AUTH_MODE", { ...ENV, AUTH_MODE: "none" }],
  ])(
    "answers %s with the configuration error page, before React Router runs",
    async (_label, env) => {
      const logged = vi.spyOn(console, "error").mockReturnValue();
      const response = await call(new Request(PROBE), env);
      expect(response.status).toBe(500);
      expect(response.headers.get("Content-Type")).toBe(
        "text/html; charset=utf-8"
      );
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(await response.text()).toContain(
        "<h1>Site configuration error</h1>"
      );
      expect(probe.loader).not.toHaveBeenCalled();
      expect(logged).toHaveBeenCalledWith(
        expect.stringMatching(/^Invalid environment:\n/)
      );
    }
  );

  it("names the bad variable in the log, never its value", async () => {
    const logged = vi.spyOn(console, "error").mockReturnValue();
    await call(new Request(PROBE), {
      ...ENV,
      AUTH_SESSION_SECRET: "too-short-secret-value",
    });
    const message = String(logged.mock.calls[0]?.[0]);
    expect(message).toContain("AUTH_SESSION_SECRET");
    expect(message).not.toContain("too-short-secret-value");
  });

  it("answers a static file the assets didn't have with a 404, not a page", async () => {
    const response = await call(
      new Request("https://app.test/assets/root-0ld.css"),
      { ...ENV }
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(probe.loader).not.toHaveBeenCalled();
  });
});
