import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createNonce,
  withSecurityHeaders,
  withStaticPageHeaders,
} from "./security-headers.server";

const env = { AUTH0_DOMAIN: "tenant.auth0.test", SENTRY_DSN: undefined };

function directives(headers: Headers): Map<string, string[]> {
  return new Map(
    (headers.get("Content-Security-Policy") ?? "")
      .split(";")
      .map(directive => directive.trim().split(/\s+/))
      .map(([name = "", ...values]) => [name, values])
  );
}

function build(
  options: Partial<Parameters<typeof withSecurityHeaders>[1]> = {},
  headers = new Headers()
) {
  return withSecurityHeaders(headers, {
    env,
    nonce: "abc123",
    development: false,
    ...options,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("security headers", () => {
  it("createNonce returns 128 random bits, base64-encoded, different every time", () => {
    const nonces = new Set(Array.from({ length: 5 }, createNonce));
    expect(nonces.size).toBe(5);
    for (const nonce of nonces) {
      expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    }
  });

  it("allows scripts only from this origin and with the request's nonce, never inline or eval", () => {
    const headers = build();
    const csp = directives(headers);
    expect(csp.get("script-src")).toEqual(["'self'", "'nonce-abc123'"]);
    expect(csp.get("object-src")).toEqual(["'none'"]);
    expect(csp.get("frame-ancestors")).toEqual(["'none'"]);
    expect(csp.get("form-action")).toEqual([
      "'self'",
      "https://tenant.auth0.test",
    ]);
    const policy = headers.get("Content-Security-Policy") ?? "";
    expect(policy).not.toContain("unsafe-inline");
    expect(policy).not.toContain("unsafe-eval");
  });

  it("connects to this origin, plus the Sentry ingest origin when a DSN is set", () => {
    expect(directives(build()).get("connect-src")).toEqual(["'self'"]);
    const csp = directives(
      build({
        env: { ...env, SENTRY_DSN: "https://key@o1.ingest.sentry.io/123" },
      })
    );
    expect(csp.get("connect-src")).toEqual([
      "'self'",
      "https://o1.ingest.sentry.io",
    ]);
  });

  it("relaxes styles and allows the HMR websocket only in development", () => {
    const csp = directives(build({ development: true }));
    expect(csp.get("style-src")).toEqual(["'self'", "'unsafe-inline'"]);
    expect(csp.get("connect-src")).toEqual(["'self'", "ws:"]);
    expect(directives(build()).get("style-src")).toEqual(["'self'"]);
  });

  it("sets the other security headers and makes responses private and vary on Cookie", () => {
    const headers = build();
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(headers.get("Cache-Control")).toBe("private, no-cache");
    expect(headers.get("Vary")).toBe("Cookie");
  });

  it("keeps a route's own Cache-Control and adds Cookie to an existing Vary once", () => {
    expect(
      build({}, new Headers({ "Cache-Control": "no-store" })).get(
        "Cache-Control"
      )
    ).toBe("no-store");
    const vary = (value: string) =>
      build({}, new Headers({ Vary: value })).get("Vary");
    expect(vary("Accept-Encoding")).toBe("Accept-Encoding, Cookie");
    expect(vary("Accept-Encoding, cookie")).toBe("Accept-Encoding, cookie");
  });

  it("replaces a CSP set elsewhere and keeps other headers", () => {
    const headers = build(
      {},
      new Headers({
        "Content-Security-Policy": "script-src *",
        "Set-Cookie": "a=b",
      })
    );
    expect(headers.get("Content-Security-Policy")).not.toContain("*");
    expect(headers.get("Set-Cookie")).toBe("a=b");
  });

  it("sends X-Robots-Tag noindex only from a build that isn't production", () => {
    expect(build().get("X-Robots-Tag")).toBeNull();
    expect(withStaticPageHeaders({}).get("X-Robots-Tag")).toBeNull();
    vi.stubGlobal("__INDEXABLE__", false);
    expect(build().get("X-Robots-Tag")).toBe("noindex");
    expect(withStaticPageHeaders({}).get("X-Robots-Tag")).toBe("noindex");
  });
});
