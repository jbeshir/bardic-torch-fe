import { data, UNSAFE_ErrorResponseImpl } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleError } from "./entry.server";
import * as indexModule from "./routes/_index";
import { loadContext } from "./test/context";
import { serveApp } from "./test/server-build";
import { routeData } from "./test/single-fetch";

const captured = vi.hoisted(() => [] as unknown[]);
vi.mock("@sentry/cloudflare", () => ({
  captureException: (error: unknown) => {
    captured.push(error);
    return "event-id";
  },
}));

/**
 * The real entry module, root and home route, plus a route that opts out of
 * caching, served the way the Worker does.
 */
const privateRoute = {
  loader: () => data({}, { headers: { "Cache-Control": "no-store" } }),
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

  it("doesn't report a 4xx answer (React Router's 405 for a POST without an action)", () => {
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

  it("keep a route's no-store", async () => {
    const response = await get("/private");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("data responses", () => {
  it("carry the security and cache headers", async () => {
    const response = await get("/_.data");
    expect(response.headers.get("X-Remix-Response")).toBe("yes");
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'"
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(await routeData(response, "root")).toEqual({
      theme: null,
      account: { state: "signed-out" },
      siteOrigin: "https://app.test",
    });
  });

  it("keep a route's no-store", async () => {
    const response = await get("/private.data");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
