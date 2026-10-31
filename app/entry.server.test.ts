import {
  createRequestHandler,
  json,
  type ServerBuild,
} from "@remix-run/cloudflare";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as entryServer from "./entry.server";
import * as rootModule from "./root";
import * as indexModule from "./routes/_index";
import { loadContext } from "./test/context";

/**
 * A server build made of the real entry module, root and home route, plus a
 * route that opts out of caching, served the way the Pages function does.
 */

const privateRoute = {
  loader: () => json({}, { headers: { "Cache-Control": "no-store" } }),
  headers: () => ({ "Cache-Control": "no-store" }),
  default: () => null,
};

function entryRoute(
  route: { id: string; parentId?: string } & (
    | { path: string }
    | { index: true }
  )
) {
  return {
    ...route,
    module: `/assets/${route.id}.js`,
    imports: [],
    hasAction: false,
    hasLoader: true,
    hasClientAction: false,
    hasClientLoader: false,
    hasErrorBoundary: route.id === "root",
  };
}

const build: ServerBuild = {
  mode: "production",
  entry: { module: entryServer },
  routes: {
    root: { id: "root", path: "", module: rootModule },
    "routes/_index": {
      id: "routes/_index",
      parentId: "root",
      index: true,
      module: indexModule,
    },
    "routes/private": {
      id: "routes/private",
      parentId: "root",
      path: "private",
      module: privateRoute,
    },
  },
  assets: {
    entry: { module: "/assets/entry.client.js", imports: [] },
    routes: {
      root: entryRoute({ id: "root", path: "" }),
      "routes/_index": {
        ...entryRoute({ id: "routes/_index", parentId: "root", index: true }),
        hasLoader: false,
      },
      "routes/private": entryRoute({
        id: "routes/private",
        parentId: "root",
        path: "private",
      }),
    },
    url: "/assets/manifest.js",
    version: "test",
  },
  publicPath: "/",
  assetsBuildDirectory: "build/client",
  future: {
    v3_fetcherPersist: true,
    v3_relativeSplatPath: true,
    v3_throwAbortReason: true,
    v3_singleFetch: false,
    v3_lazyRouteDiscovery: false,
  },
  isSpaMode: false,
};

const handler = createRequestHandler(build, "production");

function get(path: string, cookie?: string) {
  return handler(
    new Request(`https://app.test${path}`, {
      headers: { "User-Agent": "test", ...(cookie ? { Cookie: cookie } : {}) },
    }),
    loadContext()
  );
}

/** The opening `<html>` tag and every `<meta>` and stylesheet in `<head>`. */
async function head(response: Response) {
  const html = await response.text();
  const headHtml = html.slice(0, html.indexOf("</head>"));
  return {
    html: /<html\b[^>]*>/.exec(html)?.[0] ?? "",
    metas: [...headHtml.matchAll(/<meta\b[^>]*>/g)].map(([tag]) => tag),
    stylesheets: [
      ...headHtml.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g),
    ].map(([tag]) => tag),
  };
}

function scriptNonce(response: Response): string {
  const csp = response.headers.get("Content-Security-Policy") ?? "";
  return /'nonce-([^']+)'/.exec(csp)?.[1] ?? "";
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("document responses", () => {
  it("carry a nonce CSP whose nonce is on every inline script", async () => {
    const response = await get("/");
    const html = await response.text();
    const nonce = scriptNonce(response);

    expect(response.status).toBe(200);
    expect(nonce).not.toBe("");
    const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map(([tag]) => tag);
    expect(scripts.length).toBeGreaterThan(0);
    for (const tag of scripts) {
      expect(tag).toContain(`nonce="${nonce}"`);
    }
  });

  it("use a fresh nonce for every request", async () => {
    const [first, second] = await Promise.all([get("/"), get("/")]);
    expect(scriptNonce(first as Response)).not.toBe(
      scriptNonce(second as Response)
    );
  });

  it("are private, revalidated, vary on Cookie and carry the security headers", async () => {
    const response = await get("/");
    expect(response.headers.get("Content-Type")).toBe(
      "text/html; charset=utf-8"
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "form-action 'self' https://auth0.test"
    );
  });

  it("keep a route's no-store", async () => {
    const response = await get("/private");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("include the not-found document", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await get("/no-such-page");
    expect(response.status).toBe(404);
    expect(scriptNonce(response)).not.toBe("");
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache");
  });
});

describe("data responses", () => {
  it("carry the security and cache headers", async () => {
    const response = await get("/?_data=root");
    expect(response.headers.get("X-Remix-Response")).toBe("yes");
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'"
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(await response.json()).toEqual({ theme: null });
  });

  it("keep a route's no-store", async () => {
    const response = await get("/private?_data=routes%2Fprivate");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});

describe("document theme", () => {
  it.each(["light", "dark"] as const)(
    "renders an explicit %s theme from the cookie, with matching meta tags",
    async theme => {
      const { html, metas } = await head(await get("/", `theme=${theme}`));
      expect(html).toContain(`data-theme="${theme}"`);
      expect(metas).toContain(`<meta name="color-scheme" content="${theme}"/>`);
      const themeColours = metas.filter(tag => tag.includes("theme-color"));
      expect(themeColours).toHaveLength(1);
      expect(themeColours[0]).not.toContain("media=");
    }
  );

  it("leaves System (no cookie) to the device, with a theme colour per scheme", async () => {
    const { html, metas } = await head(await get("/"));
    expect(html).not.toContain("data-theme");
    expect(metas).toContain('<meta name="color-scheme" content="light dark"/>');
    const themeColours = metas.filter(tag => tag.includes("theme-color"));
    expect(themeColours).toHaveLength(2);
    expect(themeColours[0]).toContain('media="(prefers-color-scheme: light)"');
    expect(themeColours[1]).toContain('media="(prefers-color-scheme: dark)"');
  });

  it("ignores an unknown theme cookie", async () => {
    const { html } = await head(await get("/", "theme=sepia"));
    expect(html).not.toContain("data-theme");
  });

  it("links the stylesheet in <head>, where it blocks rendering", async () => {
    const { stylesheets } = await head(await get("/"));
    expect(stylesheets).toHaveLength(1);
    expect(stylesheets[0]).not.toMatch(/\b(media|disabled|onload)=/);
  });
});
