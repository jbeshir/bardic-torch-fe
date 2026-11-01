import type { CloudflareOptions } from "@sentry/cloudflare";

/**
 * The server's Sentry options (functions/_middleware.ts) from the raw
 * bindings. Without SENTRY_DSN (unset or empty) they have no DSN, so the
 * SDK stays disabled: nothing is captured or sent.
 */
export function sentryOptions(
  env: Readonly<{ SENTRY_DSN?: string }>
): CloudflareOptions {
  return {
    ...(env.SENTRY_DSN ? { dsn: env.SENTRY_DSN } : {}),
    tracesSampleRate: 0.1,
  };
}
