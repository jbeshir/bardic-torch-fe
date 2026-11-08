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
  options: Partial<Parameters<typeof withSecurityHeaders>[1]> = {}
) {
  return withSecurityHeaders(new Headers(), {
    env,
    nonce: "abc123",
    development: false,
    ...options,
  });
}

describe("createNonce", () => {
  it("returns 128 random bits, base64-encoded, different every time", () => {
    const nonces = new Set(Array.from({ length: 50 }, createNonce));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) {
      expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    }
  });
});

describe("withSecurityHeaders", () => {
  it("allows scripts only from this origin and with the request's nonce", () => {
    const csp = directives(build());
    expect(csp.get("script-src")).toEqual(["'self'", "'nonce-abc123'"]);
    expect(csp.get("default-src")).toEqual(["'self'"]);
    expect(csp.get("object-src")).toEqual(["'none'"]);
    expect(csp.get("base-uri")).toEqual(["'self'"]);
    expect(csp.get("frame-ancestors")).toEqual(["'none'"]);
  });

  it("never allows inline or eval'd scripts", () => {
    const policy = build().get("Content-Security-Policy") ?? "";
    expect(policy).not.toContain("unsafe-inline");
    expect(policy).not.toContain("unsafe-eval");
  });

  it("lets forms post here and to Auth0", () => {
    expect(directives(build()).get("form-action")).toEqual([
      "'self'",
      "https://tenant.auth0.test",
    ]);
  });

  it("connects only to this origin without a Sentry DSN", () => {
    expect(directives(build()).get("connect-src")).toEqual(["'self'"]);
  });

  it("adds the Sentry ingest origin when a DSN is set", () => {
    const csp = directives(
      build({
        env: {
          ...env,
          SENTRY_DSN: "https://key@o1.ingest.sentry.io/123",
        },
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
    expect(csp.get("script-src")).toEqual(["'self'", "'nonce-abc123'"]);
    expect(directives(build()).get("style-src")).toEqual(["'self'"]);
  });

  it("sets the other security headers", () => {
    const headers = build();
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(headers.get("Permissions-Policy")).toContain("geolocation=()");
  });

  it("makes responses private, revalidated and vary on Cookie by default", () => {
    const headers = build();
    expect(headers.get("Cache-Control")).toBe("private, no-cache");
    expect(headers.get("Vary")).toBe("Cookie");
  });

  it("keeps a route's own Cache-Control such as no-store", () => {
    const headers = withSecurityHeaders(
      new Headers({ "Cache-Control": "no-store" }),
      { env, nonce: "n", development: false }
    );
    expect(headers.get("Cache-Control")).toBe("no-store");
  });

  it("adds Cookie to an existing Vary once", () => {
    const vary = (value: string) =>
      withSecurityHeaders(new Headers({ Vary: value }), {
        env,
        nonce: "n",
        development: false,
      }).get("Vary");
    expect(vary("Accept-Encoding")).toBe("Accept-Encoding, Cookie");
    expect(vary("Accept-Encoding, cookie")).toBe("Accept-Encoding, cookie");
  });

  it("replaces a CSP set elsewhere and keeps other headers", () => {
    const headers = withSecurityHeaders(
      new Headers({
        "Content-Security-Policy": "script-src *",
        "Set-Cookie": "a=b",
      }),
      { env, nonce: "n", development: false }
    );
    expect(headers.get("Content-Security-Policy")).not.toContain("*");
    expect(headers.get("Set-Cookie")).toBe("a=b");
  });
});

describe("X-Robots-Tag", () => {
  const options = {
    env: { AUTH0_DOMAIN: "auth0.test", SENTRY_DSN: undefined },
    nonce: "n",
    development: false,
  } as const;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is not sent by a production build", () => {
    expect(
      withSecurityHeaders(new Headers(), options).get("X-Robots-Tag")
    ).toBeNull();
    expect(withStaticPageHeaders({}).get("X-Robots-Tag")).toBeNull();
  });

  it("is noindex on every response of a build that isn't production", () => {
    vi.stubGlobal("__INDEXABLE__", false);
    expect(
      withSecurityHeaders(new Headers(), options).get("X-Robots-Tag")
    ).toBe("noindex");
    expect(withStaticPageHeaders({}).get("X-Robots-Tag")).toBe("noindex");
  });
});
