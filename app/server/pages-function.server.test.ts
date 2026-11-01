import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as remixPages from "@remix-run/cloudflare-pages";
import * as logoutModule from "~/routes/auth.logout";
import * as indexModule from "~/routes/_index";
import * as themeModule from "~/routes/resources.theme";
import { APP_ORIGIN, loadContext } from "~/test/context";
import { testBuild } from "~/test/server-build";
import { createPagesHandler } from "./pages-function.server";

// The Pages Function around the real entry, root and a few routes: one
// Remix handler for every request, the environment validated per request,
// and the security headers on every answer, resource routes included.

const build = testBuild([
  { id: "routes/_index", index: true, module: indexModule, hasLoader: false },
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
]);

const ENV = loadContext().cloudflare.env;

function call(
  onRequest: ReturnType<typeof createPagesHandler>,
  request: Request,
  env: Readonly<Record<string, unknown>> = ENV
) {
  const context = {
    request,
    env: {
      ...env,
      // No static file matches, so every request reaches Remix.
      ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
    },
    data: {},
    params: {},
    functionPath: "/[[path]]",
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
    next: async () => new Response(null, { status: 404 }),
  };
  return onRequest(context as unknown as Parameters<typeof onRequest>[0]);
}

function expectSecurityHeaders(response: Response) {
  expect(response.headers.get("Content-Security-Policy")).toContain(
    "frame-ancestors 'none'"
  );
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(response.headers.get("Referrer-Policy")).toBe(
    "strict-origin-when-cross-origin"
  );
  expect(response.headers.get("Vary")).toMatch(/\bCookie\b/);
}

beforeEach(() => {
  // The Pages handler hands Remix the Workers `caches`; Node has none.
  vi.stubGlobal("caches", {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("the Pages Function", () => {
  it("builds the Remix handler once, not per request", async () => {
    const created = vi.spyOn(remixPages, "createPagesFunctionHandler");
    const onRequest = createPagesHandler(build);
    for (let i = 0; i < 3; i += 1) {
      const response = await call(onRequest, new Request(`${APP_ORIGIN}/`));
      expect(response.status).toBe(200);
    }
    expect(created).toHaveBeenCalledTimes(1);
  });

  it("serves the static configuration error page for an invalid environment", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await call(
      createPagesHandler(build),
      new Request(`${APP_ORIGIN}/`),
      { ...ENV, AUTH_SESSION_SECRET: "short" }
    );
    expect(response.status).toBe(500);
    expect(await response.text()).toContain("Site configuration error");
  });

  it("keeps entry.server's headers on documents (one nonce, in the page)", async () => {
    const response = await call(
      createPagesHandler(build),
      new Request(`${APP_ORIGIN}/`)
    );
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
      const response = await call(createPagesHandler(build), request());
      expect(response.status).toBe(status);
      expectSecurityHeaders(response);
      if (status !== 302) {
        expect(response.headers.get("Cache-Control")).toBe("no-store");
      }
    }
  );

  it("keeps a resource route's Location and cookies", async () => {
    const response = await call(
      createPagesHandler(build),
      new Request(`${APP_ORIGIN}/resources/theme`, {
        method: "POST",
        headers: {
          Origin: APP_ORIGIN,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "theme=dark&returnTo=%2Fhelp",
      })
    );
    expect(response.headers.get("Location")).toBe("/help");
    expect(response.headers.get("Set-Cookie")).toMatch(/^theme=dark;/);
  });
});
