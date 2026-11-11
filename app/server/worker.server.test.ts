import path from "node:path";
import * as Sentry from "@sentry/cloudflare";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as logoutModule from "~/routes/auth.logout";
import { APP_ORIGIN, testEnv } from "~/test/context";
import { testBuild } from "~/test/server-build";
import { sentryOptions } from "./sentry.server";
import { createWorkerHandler } from "./worker.server";

// The Worker around the real entry, root and a few routes: one React Router
// handler for every request, the environment validated per request, the
// security headers on every answer (resource routes included), and the
// answers it gives itself before React Router runs.

/** Every route module, by its path from this file (a static glob, which Vite can analyse). */
const ROUTE_MODULES = import.meta.glob<{ default?: unknown }>(
  "../routes/**/*.tsx"
);

const handled = vi.hoisted(() => ({ requests: [] as string[] }));

// React Router's handler, recorded: which
// requests reach it.
vi.mock("react-router", async importOriginal => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    createRequestHandler: (
      ...args: Parameters<typeof actual.createRequestHandler>
    ) => {
      const handle = actual.createRequestHandler(...args);
      return (...request: Parameters<typeof handle>) => {
        handled.requests.push(
          `${request[0].method} ${new URL(request[0].url).pathname}`
        );
        return handle(...request);
      };
    },
  };
});

// The SDK as it is, with its error reports counted.
vi.mock("@sentry/cloudflare", async importOriginal => {
  const actual = await importOriginal<typeof import("@sentry/cloudflare")>();
  return { ...actual, captureException: vi.fn(actual.captureException) };
});

const build = testBuild([
  {
    id: "routes/settings",
    path: "settings",
    module: { default: () => null },
    hasLoader: false,
  },
  {
    id: "routes/auth.logout",
    path: "auth/logout",
    module: logoutModule,
    hasLoader: true,
  },
  {
    id: "routes/boom",
    path: "boom",
    module: {
      default: () => null,
      loader: () => {
        throw new Error("The loader broke");
      },
      action: () => {
        throw new Error("The action broke");
      },
    },
    hasLoader: true,
  },
]);

const ENV = testEnv();

function worker() {
  return createWorkerHandler(async () => build, "production");
}

function expectSecurityHeaders(response: Response) {
  expect(response.headers.get("Content-Security-Policy")).toContain(
    "frame-ancestors 'none'"
  );
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(response.headers.get("Referrer-Policy")).toBe(
    "strict-origin-when-cross-origin"
  );
  expect(response.headers.get("Permissions-Policy")).toContain("camera=()");
}

/** The strictest policy: the Worker's own pages have no script or form. */
const STATIC_POLICY =
  "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

beforeEach(() => {
  vi.stubGlobal("__DEV_ENV_OVERRIDES__", {});
  handled.requests.length = 0;
  vi.mocked(Sentry.captureException).mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the Worker", () => {
  it("serves the static configuration error page for an invalid environment", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await worker()(new Request(`${APP_ORIGIN}/`), {
      ...ENV,
      AUTH_SESSION_SECRET: "short",
    });
    expect(response.status).toBe(500);
    expect(await response.text()).toContain("Site configuration error");
    // Like every response, with the security headers: here the strictest.
    expect(response.headers.get("Content-Security-Policy")).toBe(STATIC_POLICY);
    expectSecurityHeaders(response);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(handled.requests).toEqual([]);
  });

  it("answers a stale /assets/ URL with a plain 404, never a rendered page", async () => {
    const response = await worker()(
      new Request(`${APP_ORIGIN}/assets/entry.client-0ld.js`),
      ENV
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
    expect(response.headers.get("Content-Type")).toBe(
      "text/plain; charset=utf-8"
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Security-Policy")).toBe(STATIC_POLICY);
    expectSecurityHeaders(response);
    expect(handled.requests).toEqual([]);
  });
});

describe("the Worker's CSRF check (React Router's, answered before it runs)", () => {
  const post = (url: string, origin: string) =>
    new Request(url, {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "intent=revoke-token&tokenId=t1",
    });

  it.each([
    ["POST /settings", `${APP_ORIGIN}/settings`, "https://evil.example"],
    [
      "POST /settings.data",
      `${APP_ORIGIN}/settings.data`,
      "https://evil.example",
    ],
    ["POST /settings from Origin: null", `${APP_ORIGIN}/settings`, "null"],
  ])(
    "answers a cross-origin %s with 400 Bad Request, without React Router or a Sentry report",
    async (_case, url, origin) => {
      const response = await worker()(post(url, origin), ENV);
      expect(response.status).toBe(400);
      expect(await response.text()).toBe("Bad Request");
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.get("Content-Security-Policy")).toBe(
        STATIC_POLICY
      );
      expectSecurityHeaders(response);
      expect(handled.requests).toEqual([]);
      expect(Sentry.captureException).not.toHaveBeenCalled();
    }
  );

  it("leaves exactly the app's resource routes (the routes without a component) to their own check", async () => {
    Object.assign(globalThis, {
      __reactRouterAppDirectory: path.join(process.cwd(), "app"),
    });
    const { default: routes } = await import("~/routes");
    type Entry = Awaited<typeof routes>[number];
    /** Every route of app/routes as a URL path, and whether it renders. */
    const found: { path: string; page: boolean }[] = [];
    async function collect(entries: readonly Entry[], parent: string) {
      for (const route of entries) {
        const routePath = [parent, route.path].filter(Boolean).join("/");
        const load = ROUTE_MODULES[`../${route.file}`];
        if (load === undefined) {
          throw new Error(`${route.file} is not in ROUTE_MODULES`);
        }
        const module = await load();
        found.push({
          path: `/${routePath.replace(/:\w+|\*/g, "x")}`,
          page: module.default !== undefined,
        });
        await collect(route.children ?? [], routePath);
      }
    }
    await collect(await routes, "");
    vi.unstubAllEnvs();

    const fetch = worker();
    for (const route of found) {
      handled.requests.length = 0;
      const response = await fetch(
        post(`${APP_ORIGIN}${route.path}`, "https://evil.example"),
        ENV
      );
      // A page's action is refused here; a resource route gets the request.
      expect({
        path: route.path,
        refused: response.status === 400 && !handled.requests.length,
      }).toEqual({ path: route.path, refused: route.page });
    }
  });
});

describe("server-side Sentry (withSentry around the Worker)", () => {
  type Sent = { readonly envelopes: string[] };

  /** The Worker as workers/app.ts exports it, sending to a recorder. */
  function sentryWorker(dsn: string | undefined) {
    const sent: Sent = { envelopes: [] };
    const fetch = worker();
    const inner: ExportedHandler<Record<string, unknown>> = {
      fetch: (request, env) => fetch(request, env),
    };
    const handler = Sentry.withSentry(
      env => ({
        ...sentryOptions(env),
        ...(dsn ? { dsn } : {}),
        tracesSampleRate: 1,
        // A client per test, not the isolate's one cached client.
        cacheClient: false,
        transport: () => ({
          send: async envelope => {
            sent.envelopes.push(JSON.stringify(envelope));
            return {};
          },
          flush: async () => true,
        }),
      }),
      inner
    );
    const waiting: Promise<unknown>[] = [];
    const context = {
      waitUntil: (promise: Promise<unknown>) => waiting.push(promise),
      passThroughOnException: () => undefined,
      props: {},
    };
    return {
      sent,
      async call(request: Request) {
        const response = await handler.fetch?.(
          request as never,
          ENV as never,
          context as never
        );
        await Promise.all(waiting);
        return response;
      },
    };
  }

  /** What a reader's browser sends with a request: none of it may reach Sentry. */
  const PRIVATE = {
    Cookie: "__Host-bt_session=cookie-secret",
    Authorization: "Bearer header-secret",
    "X-Forwarded-For": "203.0.113.7",
    "CF-Connecting-IP": "203.0.113.7",
    "User-Agent": "agent-secret",
  };
  const NOTHING_PRIVATE = /secret|203\.0\.113\.7|ip_address|cookies/;

  it("reports a loader's error once, without the request's query string, cookies, headers or IP address", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { sent, call } = sentryWorker("https://public@sentry.invalid/1");
    const response = await call(
      new Request(`${APP_ORIGIN}/boom?code=query-secret`, { headers: PRIVATE })
    );
    expect(response?.status).toBe(500);

    const errors = sent.envelopes.filter(envelope =>
      envelope.includes('"type":"event"')
    );
    expect(errors).toHaveLength(1);
    const [, [[, event]]] = JSON.parse(errors[0] ?? "") as [
      unknown,
      [[unknown, { request?: Record<string, unknown>; user?: unknown }]],
    ];
    expect(event.request?.url).toBe(`${APP_ORIGIN}/boom`);
    expect(event.request).not.toHaveProperty("cookies");
    expect(event.request).not.toHaveProperty("headers");
    expect(event.request).not.toHaveProperty("data");
    expect(event.request).not.toHaveProperty("query_string");
    expect(event.user).toBeUndefined();
    expect(sent.envelopes.join("")).not.toMatch(NOTHING_PRIVATE);
  });

  it("sends spans without the request's query string, headers or body", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { sent, call } = sentryWorker("https://public@sentry.invalid/1");
    await call(
      new Request(`${APP_ORIGIN}/boom?code=query-secret`, {
        method: "POST",
        headers: {
          ...PRIVATE,
          Origin: APP_ORIGIN,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "token=body-secret",
      })
    );
    const spans = sent.envelopes.filter(envelope =>
      envelope.includes('"type":"span"')
    );
    expect(spans.length).toBeGreaterThan(0);
    expect(spans.join("")).toContain(
      `"url.full":{"value":"${APP_ORIGIN}/boom"`
    );
    expect(sent.envelopes.join("")).not.toMatch(NOTHING_PRIVATE);
  });
});
