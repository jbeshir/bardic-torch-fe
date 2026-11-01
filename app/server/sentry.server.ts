import type { CloudflareOptions } from "@sentry/cloudflare";

type WithRequest = {
  request?: { url?: string | undefined; query_string?: unknown } | undefined;
};

/**
 * An event without the request's query string: it can carry one-time
 * secrets (`/auth/callback?code=…&state=…`), and no page needs it to
 * explain an error.
 */
function withoutQuery<Event extends WithRequest>(event: Event): Event {
  const { request } = event;
  if (!request) return event;
  const { query_string: _query, ...rest } = request;
  const url = rest.url?.split(/[?#]/)[0];
  return { ...event, request: { ...rest, ...(url ? { url } : {}) } };
}

/**
 * The server's Sentry options (functions/_middleware.ts) from the raw
 * bindings. Without SENTRY_DSN (unset or empty) they have no DSN, so the
 * SDK stays disabled: nothing is captured or sent. Events and traces go
 * without their request's query string.
 */
export function sentryOptions(
  env: Readonly<{ SENTRY_DSN?: string }>
): CloudflareOptions {
  return {
    ...(env.SENTRY_DSN ? { dsn: env.SENTRY_DSN } : {}),
    tracesSampleRate: 0.1,
    beforeSend: withoutQuery,
    beforeSendTransaction: withoutQuery,
  };
}
