import path from "node:path";
import * as Sentry from "@sentry/cloudflare";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as logoutModule from "~/routes/auth.logout";
import * as indexModule from "~/routes/_index";
import * as themeModule from "~/routes/resources.theme";
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

const handled = vi.hoisted(() => ({ requests: [] as string[], created: 0 }));

// React Router's handler, counted: how often it is created, and which
// requests reach it.
vi.mock("react-router", async importOriginal => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    createRequestHandler: (
      ...args: Parameters<typeof actual.createRequestHandler>
    ) => {
      handled.created += 1;
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
  { id: "routes/_index", index: true, module: indexModule, hasLoader: false },
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
    id: "routes/resources.theme",
    path: "resources/theme",
    module: themeModule,
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

function expectVaryCookie(response: Response) {
  expect(response.headers.get("Vary")).toMatch(/\bCookie\b/);
}

/** The strictest policy: the Worker's own pages have no script or form. */
const STATIC_POLICY =
  "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

beforeEach(() => {
  vi.stubGlobal("__DEV_ENV_OVERRIDES__", {});
  handled.requests.length = 0;
  handled.created = 0;
  vi.mocked(Sentry.captureException).mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the Worker", () => {
  it("builds the React Router handler once, not per request", async () => {
    const fetch = worker();
    for (let i = 0; i < 3; i += 1) {
      const response = await fetch(new Request(`${APP_ORIGIN}/`), ENV);
      expect(response.status).toBe(200);
    }
    expect(handled.created).toBe(1);
    expect(handled.requests).toHaveLength(3);
  });

  it("loads the server build once per isolate, so React Router derives its routes once", async () => {
    const loadBuild = vi.fn(async () => build);
    const fetch = createWorkerHandler(loadBuild, "production");
    // Two first requests at once share the one load.
    const responses = await Promise.all([
      fetch(new Request(`${APP_ORIGIN}/`), ENV),
      fetch(new Request(`${APP_ORIGIN}/`), ENV),
    ]);
    expect((await fetch(new Request(`${APP_ORIGIN}/`), ENV)).status).toBe(200);
    expect(responses.map(response => response.status)).toEqual([200, 200]);
    expect(loadBuild).toHaveBeenCalledTimes(1);
    expect(handled.created).toBe(1);
  });

  it("loads the server build for every request in development, so an edited route is served", async () => {
    const loadBuild = vi.fn(async () => build);
    const fetch = createWorkerHandler(loadBuild, "development");
    for (let i = 0; i < 3; i += 1) {
      expect((await fetch(new Request(`${APP_ORIGIN}/`), ENV)).status).toBe(
        200
      );
    }
    expect(loadBuild).toHaveBeenCalledTimes(3);
    expect(handled.created).toBe(1);
  });

  it("loads the server build again after a failed load", async () => {
    const failure = new Error("The build failed to load");
    const loadBuild = vi
      .fn<() => Promise<typeof build>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValue(build);
    const fetch = createWorkerHandler(loadBuild, "production");
    await expect(fetch(new Request(`${APP_ORIGIN}/`), ENV)).rejects.toBe(
      failure
    );
    expect((await fetch(new Request(`${APP_ORIGIN}/`), ENV)).status).toBe(200);
    expect(loadBuild).toHaveBeenCalledTimes(2);
  });

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

  it("lays the dev server's variables over the bindings (`npm run dev:fixtures`), and nothing in a build", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const broken = { ...ENV, AUTH_SESSION_SECRET: "short" };
    // A build: `{}`, so only the bindings count.
    expect((await worker()(new Request(`${APP_ORIGIN}/`), broken)).status).toBe(
      500
    );
    // `react-router dev` with the secret set in the process environment.
    vi.stubGlobal("__DEV_ENV_OVERRIDES__", {
      AUTH_SESSION_SECRET: "a-dev-secret-of-at-least-32-characters",
    });
    expect((await worker()(new Request(`${APP_ORIGIN}/`), broken)).status).toBe(
      200
    );
    expect(
      consoleError.mock.calls.filter(([message]) =>
        String(message).startsWith("Invalid environment")
      )
    ).toHaveLength(1);
  });

  it("keeps entry.server's headers on documents (one nonce, in the page)", async () => {
    const response = await worker()(new Request(`${APP_ORIGIN}/`), ENV);
    const nonce = /'nonce-([^']+)'/.exec(
      response.headers.get("Content-Security-Policy") ?? ""
    )?.[1];
    expect(await response.text()).toContain(`nonce="${nonce}"`);
  });

  it.each([
    [
      "the GET /auth/logout redirect",
      () => new Request(`${APP_ORIGIN}/auth/logout`),
      302,
    ],
    [
      "a cross-site POST’s CSRF 403",
      () =>
        new Request(`${APP_ORIGIN}/auth/logout`, {
          method: "POST",
          headers: { Origin: "https://evil.example" },
        }),
      403,
    ],
    [
      "the no-JS theme form’s 303",
      () =>
        new Request(`${APP_ORIGIN}/resources/theme`, {
          method: "POST",
          headers: {
            Origin: APP_ORIGIN,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: "theme=dark&returnTo=%2Fhelp",
        }),
      303,
    ],
    [
      "the theme route’s GET 405",
      () => new Request(`${APP_ORIGIN}/resources/theme`),
      405,
    ],
  ])(
    "adds the security headers to %s, keeping its own",
    async (_case, request, status) => {
      const response = await worker()(request(), ENV);
      expect(response.status).toBe(status);
      expectSecurityHeaders(response);
      expectVaryCookie(response);
      if (status !== 302) {
        expect(response.headers.get("Cache-Control")).toBe("no-store");
      }
    }
  );

  it("adds the security headers to the lazy route discovery manifest, keeping its own", async () => {
    // React Router answers /__manifest before any route, and without the
    // entry.server hooks; the build's version is "test".
    const fetch = worker();
    const patches = await fetch(
      new Request(
        `${APP_ORIGIN}/__manifest?paths=%2Fauth%2Flogout&version=test`
      ),
      ENV
    );
    expect(patches.status).toBe(200);
    expectSecurityHeaders(patches);
    expectVaryCookie(patches);
    expect(patches.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable"
    );
    expect(Object.keys(await patches.json())).toContain("routes/auth.logout");

    // A page from an older build is told to reload instead.
    const stale = await fetch(
      new Request(
        `${APP_ORIGIN}/__manifest?paths=%2Fauth%2Flogout&version=old`
      ),
      ENV
    );
    expect(stale.status).toBe(204);
    expect(stale.headers.get("X-Remix-Reload-Document")).toBe("true");
    expectSecurityHeaders(stale);
    expectVaryCookie(stale);
  });

  it("keeps a resource route's Location and cookies", async () => {
    const response = await worker()(
      new Request(`${APP_ORIGIN}/resources/theme`, {
        method: "POST",
        headers: {
          Origin: APP_ORIGIN,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "theme=dark&returnTo=%2Fhelp",
      }),
      ENV
    );
    expect(response.headers.get("Location")).toBe("/help");
    expect(response.headers.get("Set-Cookie")).toMatch(/^theme=dark;/);
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

  it("lets a same-origin POST /settings reach React Router (its 405 page)", async () => {
    const response = await worker()(
      post(`${APP_ORIGIN}/settings`, APP_ORIGIN),
      ENV
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("Content-Type")).toBe(
      "text/html; charset=utf-8"
    );
    expect(handled.requests).toEqual(["POST /settings"]);
  });

  it("leaves resource routes to their own check: a cross-site POST /auth/logout gets its 403", async () => {
    const response = await worker()(
      post(`${APP_ORIGIN}/auth/logout`, "https://evil.example"),
      ENV
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "forbidden",
        message: "This request must come from the Bardic Torch site.",
      },
    });
    expect(handled.requests).toEqual(["POST /auth/logout"]);
  });

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
    // The resource routes by name, so a new or swapped one shows here.
    expect(
      found
        .filter(route => !route.page)
        .map(route => route.path)
        .sort()
    ).toEqual([
      "/api/me",
      "/auth/callback",
      "/auth/login",
      "/auth/logout",
      "/resources/theme",
      "/robots.txt",
      "/sitemap.xml",
    ]);

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

  it("sends nothing without a DSN", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const network = vi.spyOn(globalThis, "fetch");
    const { sent, call } = sentryWorker(undefined);
    expect((await call(new Request(`${APP_ORIGIN}/boom`)))?.status).toBe(500);
    expect(sent.envelopes).toEqual([]);
    expect(network).not.toHaveBeenCalled();
  });
});
