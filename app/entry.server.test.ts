import { json } from "@remix-run/cloudflare";
import { UNSAFE_ErrorResponseImpl } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleError } from "./entry.server";
import * as indexModule from "./routes/_index";
import { loadContext } from "./test/context";
import { serveApp } from "./test/server-build";

const captured = vi.hoisted(() => [] as unknown[]);
vi.mock("@sentry/cloudflare", () => ({
  captureException: (error: unknown) => {
    captured.push(error);
    return "event-id";
  },
}));

/**
 * The real entry module, root and home route, plus a route that opts out of
 * caching, served the way the Pages function does.
 */
const privateRoute = {
  loader: () => json({}, { headers: { "Cache-Control": "no-store" } }),
  headers: () => ({ "Cache-Control": "no-store" }),
  default: () => null,
};

const broken = {
  loader: () => {
    throw new Error("The loader broke");
  },
  default: () => null,
};
const brokenRender = {
  default: () => {
    throw new Error("The page broke while rendering");
  },
};

const get = serveApp([
  { id: "routes/_index", index: true, module: indexModule, hasLoader: false },
  {
    id: "routes/private",
    path: "private",
    module: privateRoute,
    hasLoader: true,
  },
  { id: "routes/broken", path: "broken", module: broken, hasLoader: true },
  {
    id: "routes/render",
    path: "render",
    module: brokenRender,
    hasLoader: false,
  },
]);

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
  captured.length = 0;
  vi.restoreAllMocks();
});

describe("server error reporting (R28)", () => {
  it("logs and reports what a loader throws, through handleError", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const response = await get("/broken");
    expect(response.status).toBe(500);
    expect(captured).toEqual([
      expect.objectContaining({ message: "The loader broke" }),
    ]);
    expect(consoleError).toHaveBeenCalledWith(captured[0]);
  });

  it("logs and reports an error thrown while rendering", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await get("/render");
    expect(response.status).toBe(500);
    expect(captured).toContainEqual(
      expect.objectContaining({ message: "The page broke while rendering" })
    );
  });

  it("doesn't report a 4xx answer (Remix's 405 for a POST without an action)", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    handleError(
      new UNSAFE_ErrorResponseImpl(405, "Method Not Allowed", "no action"),
      {
        request: new Request("https://app.test/", { method: "POST" }),
        params: {},
        context: loadContext(),
      }
    );
    expect(captured).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("reports an error once, though it reaches both handlers", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const error = new Error("Seen twice");
    const args = {
      request: new Request("https://app.test/"),
      params: {},
      context: loadContext(),
    };
    handleError(error, args);
    handleError(error, args);
    expect(captured).toEqual([error]);
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("ignores a request the reader abandoned", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const controller = new AbortController();
    controller.abort();
    handleError(new Error("aborted"), {
      request: new Request("https://app.test/", { signal: controller.signal }),
      params: {},
      context: loadContext(),
    });
    expect(captured).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
  });
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

  it("render the toast region once, after the page and empty", async () => {
    const html = await (await get("/")).text();
    const regions = [
      ...html.matchAll(
        /<section aria-label="Notifications"[\s\S]*?<\/section>/g
      ),
    ].map(([region]) => region);
    expect(regions).toHaveLength(1);
    const region = regions[0] ?? "";
    expect(html.indexOf(region)).toBeGreaterThan(html.indexOf("</main>"));
    expect(region).toMatch(
      /<div role="status" aria-live="polite"[^>]*><\/div>/
    );
    expect(region).toMatch(
      /<div role="alert" aria-live="assertive"[^>]*><\/div>/
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
    expect(await response.json()).toEqual({
      theme: null,
      account: { state: "signed-out" },
    });
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

describe("the shell without JS", () => {
  async function page() {
    return (await get("/")).text();
  }

  it("renders the landmarks, the skip link first and the one Site nav after main", async () => {
    const html = await page();
    const body = html.slice(html.indexOf("<body"));
    expect(body.indexOf('href="#content"')).toBeLessThan(
      body.indexOf("<header")
    );
    const main = body.indexOf('<main id="content"');
    const nav = body.indexOf('<nav id="site-nav" aria-label="Site"');
    const footer = body.indexOf("<footer");
    expect(main).toBeGreaterThan(-1);
    expect(nav).toBeGreaterThan(body.indexOf("</main>"));
    expect(footer).toBeGreaterThan(nav);
    expect(body.match(/aria-label="Site"/g)).toHaveLength(1);
  });

  it("makes Menu and Search links to the site menu, which isn't hidden", async () => {
    const html = await page();
    expect(html.match(/<a href="#site-nav"/g)?.length).toBe(3);
    expect(html).not.toContain('aria-haspopup="dialog"');
    const nav = /<nav id="site-nav"[^>]*class="([^"]*)"/.exec(html)?.[1] ?? "";
    expect(nav.split(" ")).not.toContain("hidden");
  });

  it("signed out, offers Log in back to this page", async () => {
    const html = await page();
    expect(html).toContain('href="/auth/login?returnTo=%2F"');
    expect(html).not.toContain("<details");
  });

  it("has no inline styles, which the CSP would block", async () => {
    expect(await page()).not.toMatch(/\sstyle="/);
  });
});
