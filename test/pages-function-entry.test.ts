import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadContext } from "~/test/context";
import { callPagesFunction } from "~/test/pages-context";
import { onRequest } from "../functions/[[path]]";

// functions/[[path]].ts, the module Cloudflare Pages actually runs, wired to
// a build whose only route counts its calls. An invalid environment must be
// answered with the static 500 page before Remix (and so any loader) runs.

const probe = vi.hoisted(() => ({
  loader: vi.fn(() => new Response("probe", { status: 200 })),
}));

// A mocked module must define every export Remix reads, so the build's
// optional `basename` is spelled out.
vi.mock("server-build", async () => {
  const { testBuild } = await import("~/test/server-build");
  const build = testBuild([
    {
      id: "routes/probe",
      path: "probe",
      module: { loader: probe.loader },
      hasLoader: true,
    },
  ]);
  return { ...build, basename: undefined };
});

const ENV = loadContext().cloudflare.env;
const PROBE = "https://app.test/probe";

beforeEach(() => {
  // The Pages handler hands Remix the Workers `caches`; Node has none.
  vi.stubGlobal("caches", {});
  probe.loader.mockClear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("functions/[[path]].ts", () => {
  it("serves the build's routes with a valid environment", async () => {
    const response = await callPagesFunction(onRequest, new Request(PROBE), {
      ...ENV,
    });
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
    "answers %s with the configuration error page, before Remix runs",
    async (_label, env) => {
      const logged = vi.spyOn(console, "error").mockReturnValue();
      const response = await callPagesFunction(
        onRequest,
        new Request(PROBE),
        env
      );
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
    await callPagesFunction(onRequest, new Request(PROBE), {
      ...ENV,
      AUTH_SESSION_SECRET: "too-short-secret-value",
    });
    const message = String(logged.mock.calls[0]?.[0]);
    expect(message).toContain("AUTH_SESSION_SECRET");
    expect(message).not.toContain("too-short-secret-value");
  });
});
