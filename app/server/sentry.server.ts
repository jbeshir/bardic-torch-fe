import type { CloudflareOptions } from "@sentry/cloudflare";
import { SENTRY_DATA_COLLECTION } from "~/constants/sentry";

type BeforeSendSpan = NonNullable<CloudflareOptions["beforeSendSpan"]>;
type StreamedSpan = Parameters<BeforeSendSpan>[0];

type WithRequest = {
  request?: { url?: string | undefined; query_string?: unknown } | undefined;
};

/** `url` up to its query string or fragment. */
function withoutQueryString(url: string): string {
  return url.split(/[?#]/)[0] ?? url;
}

/**
 * An event without the request's query string: it can carry one-time
 * secrets (`/auth/callback?code=…&state=…`), and no page needs it to
 * explain an error.
 */
function withoutQuery<Event extends WithRequest>(event: Event): Event {
  const { request } = event;
  if (!request) return event;
  const { query_string: _query, ...rest } = request;
  const url = rest.url === undefined ? undefined : withoutQueryString(rest.url);
  return { ...event, request: { ...rest, ...(url ? { url } : {}) } };
}

/** Span attributes that hold a URL, sent without its query string. */
const URL_ATTRIBUTES = ["url.full", "http.url", "http.target", "url.path"];

/**
 * Span attributes never sent: the query string, and what the request's
 * headers say about the reader (the SDK records the User-Agent whatever
 * `dataCollection` says).
 */
const PRIVATE_ATTRIBUTE =
  /^(?:http\.query|url\.query|user_agent\.|http\.(?:request|response)\.header\.|client\.address)/;

/**
 * A span (sent as it streams; v11 no longer calls `beforeSendTransaction`)
 * without the request's query string, in its name or its attributes, and
 * without the reader's User-Agent or other header values.
 */
function spanWithoutQuery(span: StreamedSpan): StreamedSpan {
  const attributes = Object.fromEntries(
    Object.entries(span.attributes)
      .filter(([key]) => !PRIVATE_ATTRIBUTE.test(key))
      .map(([key, value]) => [
        key,
        URL_ATTRIBUTES.includes(key) && typeof value === "string"
          ? withoutQueryString(value)
          : value,
      ])
  );
  return { ...span, name: withoutQueryString(span.name), attributes };
}

/**
 * The server's Sentry options (workers/app.ts's `withSentry`) from the raw
 * bindings. Without SENTRY_DSN (unset or empty) they have no DSN, so the
 * SDK stays disabled: nothing is captured or sent. Events and spans go
 * without their request's query string, and with none of the request's
 * cookies, headers, body or client IP (`SENTRY_DATA_COLLECTION`).
 */
export function sentryOptions(env: object): CloudflareOptions {
  const dsn =
    "SENTRY_DSN" in env && typeof env.SENTRY_DSN === "string"
      ? env.SENTRY_DSN
      : "";
  return {
    ...(dsn ? { dsn } : {}),
    tracesSampleRate: 0.1,
    dataCollection: SENTRY_DATA_COLLECTION,
    beforeSend: withoutQuery,
    beforeSendSpan: spanWithoutQuery,
  };
}
