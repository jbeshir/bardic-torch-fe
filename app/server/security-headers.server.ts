import type { AppEnv } from "./env.server";

/**
 * Headers for every response the app makes: entry.server adds them to
 * documents and `?_data` answers, the Pages Function (pages-function.server)
 * to everything else (resource routes).
 * Scripts run only from this origin or with the per-request nonce; forms
 * may post here or to Auth0 (logout redirects there); nothing may frame
 * the site.
 */

type SecurityHeaderOptions = {
  readonly env: Pick<AppEnv, "AUTH0_DOMAIN" | "SENTRY_DSN">;
  readonly nonce: string;
  /**
   * Vite dev injects styles from JS and serves HMR over its own websocket
   * port; development builds allow both.
   */
  readonly development: boolean;
};

const DOCUMENT_CACHE_CONTROL = "private, no-cache";

/** A fresh base64 nonce of 128 random bits. */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

function sentryOrigin(dsn: string | undefined): string[] {
  if (!dsn) return [];
  try {
    return [new URL(dsn).origin];
  } catch {
    return [];
  }
}

function contentSecurityPolicy({
  env,
  nonce,
  development,
}: SecurityHeaderOptions): string {
  const connect = [
    "'self'",
    ...sentryOrigin(env.SENTRY_DSN),
    ...(development ? ["ws:"] : []),
  ];
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self'${development ? " 'unsafe-inline'" : ""}`,
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${connect.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' https://${env.AUTH0_DOMAIN}`,
    "frame-ancestors 'none'",
  ].join("; ");
}

/**
 * `headers` plus the security headers. Responses are private and revalidated
 * unless the route chose its own Cache-Control (such as `no-store`), and
 * vary on Cookie because they depend on the session.
 */
export function withSecurityHeaders(
  headers: Headers,
  options: SecurityHeaderOptions
): Headers {
  const result = new Headers(headers);
  result.set("Content-Security-Policy", contentSecurityPolicy(options));
  result.set("X-Content-Type-Options", "nosniff");
  result.set("Referrer-Policy", "strict-origin-when-cross-origin");
  result.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
  );
  if (!result.has("Cache-Control")) {
    result.set("Cache-Control", DOCUMENT_CACHE_CONTROL);
  }
  const vary = result.get("Vary");
  if (
    !vary?.split(",").some(value => value.trim().toLowerCase() === "cookie")
  ) {
    result.set("Vary", vary ? `${vary}, Cookie` : "Cookie");
  }
  return result;
}
