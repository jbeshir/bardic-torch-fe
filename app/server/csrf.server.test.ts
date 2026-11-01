import {
  createRequestHandler,
  type ActionFunctionArgs,
} from "@remix-run/cloudflare";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SETTINGS_INTENT } from "~/constants/account";
import { action as updateMe } from "~/routes/api.me";
import { action as createToken } from "~/routes/api.tokens";
import { action as revokeToken } from "~/routes/api.tokens.$tokenId";
import { action as logout } from "~/routes/auth.logout";
import { action as saveTheme } from "~/routes/resources.theme";
import * as settingsModule from "~/routes/settings";
import { APP_ORIGIN, loadContext } from "~/test/context";
import { runAction } from "~/test/proxy";
import { testBuild } from "~/test/server-build";
import { assertSameOrigin } from "./csrf.server";

/**
 * Every route that changes state: each route module exporting a server
 * `action` must be here (checked below against the route files).
 */
const ROUTES: ReadonlyArray<{
  name: string;
  method: string;
  path: string;
  action: (args: ActionFunctionArgs) => Promise<Response>;
  params?: Record<string, string>;
}> = [
  {
    name: "/auth/logout",
    method: "POST",
    path: "/auth/logout",
    action: logout,
  },
  {
    name: "/resources/theme",
    method: "POST",
    path: "/resources/theme",
    action: saveTheme,
  },
  { name: "/api/me", method: "PATCH", path: "/api/me", action: updateMe },
  {
    name: "/api/tokens",
    method: "POST",
    path: "/api/tokens",
    action: createToken,
  },
  {
    name: "/api/tokens/:tokenId",
    method: "DELETE",
    path: "/api/tokens/t1",
    action: revokeToken,
    params: { tokenId: "t1" },
  },
];

type RouteModule = Readonly<Record<string, unknown>>;

/** Every route module, as Remix finds them (co-located tests excluded). */
const ROUTE_MODULES: Readonly<Record<string, RouteModule>> = import.meta.glob(
  ["../routes/**/*.{ts,tsx,js,jsx,md,mdx}", "!../routes/**/*.test.{ts,tsx}"],
  { eager: true }
);

/**
 * Route modules that take submissions without a server `action`, and why
 * that is safe. Each reason is tested below.
 */
const CLIENT_ONLY_SUBMISSIONS: Readonly<Record<string, string>> = {
  "../routes/settings.tsx":
    "Its clientAction runs in the browser and only re-sends each form, same-origin, to an /api proxy route in ROUTES; a POST to /settings itself finds no server action.",
};

function routeFilesExporting(name: string): string[] {
  return Object.entries(ROUTE_MODULES)
    .filter(([, module]) => typeof module[name] === "function")
    .map(([file]) => file)
    .sort();
}

describe("the table of state-changing routes", () => {
  it("is checked against the route files", () => {
    const files = Object.keys(ROUTE_MODULES);
    expect(files).toContain("../routes/api.me.tsx");
    expect(files).not.toContain("../routes/api.me.test.ts");
  });

  it("lists every route file that exports an action", () => {
    const tabled = new Set<unknown>(ROUTES.map(route => route.action));
    const withAction = routeFilesExporting("action");
    expect(
      withAction.filter(file => !tabled.has(ROUTE_MODULES[file]?.action)),
      "route files exporting an action that ROUTES does not list"
    ).toEqual([]);
    expect(withAction).toHaveLength(ROUTES.length);
  });

  it("gives a reason for every route that takes submissions without an action", () => {
    expect(routeFilesExporting("clientAction")).toEqual(
      Object.keys(CLIENT_ONLY_SUBMISSIONS).sort()
    );
    for (const file of Object.keys(CLIENT_ONLY_SUBMISSIONS)) {
      expect(ROUTE_MODULES[file]?.action, file).toBeUndefined();
    }
  });
});

describe("/settings submissions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Where the settings clientAction sends a form, as "METHOD /path". */
  async function destinations(form: Record<string, string>) {
    const sent: string[] = [];
    vi.stubGlobal("fetch", async (input: string, init: RequestInit) => {
      sent.push(`${init.method ?? "GET"} ${input}`);
      return Response.json({ ok: true, data: null });
    });
    await settingsModule.clientAction({
      request: new Request(`${APP_ORIGIN}/settings`, {
        method: "POST",
        body: new URLSearchParams(form),
      }),
      params: {},
      serverAction: () => {
        throw new Error("/settings has no server action");
      },
    });
    return sent;
  }

  /** The ROUTES entry a "METHOD /path" request reaches, if any. */
  function tabledRoute(sent: string) {
    return ROUTES.find(route => {
      const path = route.name.replace(/:[^/]+/g, "[^/]+");
      return new RegExp(`^${route.method} ${path}$`).test(sent);
    })?.name;
  }

  it.each([
    [SETTINGS_INTENT.updateProfile, { display_name: "Morwen" }, "/api/me"],
    [SETTINGS_INTENT.createToken, { name: "Laptop" }, "/api/tokens"],
    [SETTINGS_INTENT.revokeToken, { tokenId: "a/b" }, "/api/tokens/:tokenId"],
  ])(
    "sends %s same-origin to a CSRF-checked route",
    async (intent, fields, route) => {
      const sent = await destinations({ intent, ...fields });
      expect(sent).toHaveLength(1);
      // A path, not a URL: the browser sends this site's Origin with it.
      expect(sent[0]).toMatch(/^[A-Z]+ \/api\//);
      expect(tabledRoute(sent[0] ?? "")).toBe(route);
    }
  );

  it("are refused when posted to /settings itself, cross-site or not", async () => {
    vi.spyOn(console, "error").mockReturnValue();
    const handle = createRequestHandler(
      testBuild([
        {
          id: "routes/settings",
          path: "settings",
          module: settingsModule,
          hasLoader: true,
        },
      ]),
      "production"
    );
    const response = await handle(
      new Request(`${APP_ORIGIN}/settings?_data=routes%2Fsettings`, {
        method: "POST",
        headers: {
          Origin: "https://evil.example",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          intent: SETTINGS_INTENT.revokeToken,
          tokenId: "t1",
        }),
      }),
      loadContext()
    );
    expect(response.status).toBe(405);
  });

  it("sends an unknown form nowhere", async () => {
    expect(await destinations({ intent: "delete-account" })).toEqual([]);
  });
});

const REJECTED: ReadonlyArray<[string, Record<string, string>]> = [
  ["no Origin and no Sec-Fetch-Site", {}],
  ["a cross-site Origin", { Origin: "https://evil.example" }],
  ["a sibling subdomain", { Origin: "https://evil.app.test" }],
  ["a lookalike suffix", { Origin: "https://app.test.evil.example" }],
  ["a different scheme", { Origin: "http://app.test" }],
  ["a different port", { Origin: "https://app.test:8443" }],
  ["Origin: null", { Origin: "null" }],
  ["Sec-Fetch-Site: cross-site", { "Sec-Fetch-Site": "cross-site" }],
  ["Sec-Fetch-Site: same-site", { "Sec-Fetch-Site": "same-site" }],
  ["Sec-Fetch-Site: none", { "Sec-Fetch-Site": "none" }],
  [
    "a cross-site Origin claiming same-origin fetch metadata",
    { Origin: "https://evil.example", "Sec-Fetch-Site": "same-origin" },
  ],
];

const ACCEPTED: ReadonlyArray<[string, Record<string, string>]> = [
  ["a matching Origin", { Origin: APP_ORIGIN }],
  [
    "no Origin with Sec-Fetch-Site: same-origin",
    { "Sec-Fetch-Site": "same-origin" },
  ],
];

function request(
  method: string,
  path: string,
  headers: Record<string, string>
) {
  return new Request(`${APP_ORIGIN}${path}`, {
    method,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body: "",
  });
}

describe("assertSameOrigin on every state-changing route", () => {
  describe.each(ROUTES)("$name", route => {
    it.each(REJECTED)("rejects %s with 403", async (_label, headers) => {
      const response = await runAction(
        route.action,
        request(route.method, route.path, headers),
        route.params
      );
      expect(response.status).toBe(403);
      expect(response.headers.get("Set-Cookie")).toBeNull();
      expect(await response.json()).toEqual({
        ok: false,
        error: {
          code: "forbidden",
          message: "This request must come from the Bardic Torch site.",
        },
      });
    });

    it.each(ACCEPTED)("lets %s through", async (_label, headers) => {
      const response = await runAction(
        route.action,
        request(route.method, route.path, headers),
        route.params
      );
      expect(response.status).not.toBe(403);
    });
  });
});

describe("assertSameOrigin", () => {
  it("compares against the request's own origin, port included", () => {
    const local = new Request("http://127.0.0.1:8788/api/me", {
      method: "PATCH",
      headers: { Origin: "http://127.0.0.1:8788" },
    });
    expect(() => assertSameOrigin(local)).not.toThrow();
  });
});
