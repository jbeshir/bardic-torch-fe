import type { UpstreamErrorCode } from "./api";

/**
 * The JSON body of every `/api/*` proxy response (`proxyResponse` in
 * api.server.ts), as the settings page's fetchers read it. `message` is
 * always the app's own copy, never the API's, in one voice ("We
 * couldn’t…").
 */

/**
 * Every `code` an error body can carry: the API's own; the proxy's (the
 * API timed out, couldn't be reached or answered something unreadable, a
 * method it doesn't route); the CSRF check's; and the browser's own
 * (`sendForm`: offline, or an answer the app didn't make).
 */
export type ProxyErrorCode =
  | UpstreamErrorCode
  | "upstream_unavailable"
  | "bad_gateway"
  | "method_not_allowed"
  | "forbidden"
  | "offline"
  | "unexpected_response";

/** An answer nobody can read: the proxy's 502 and the browser's alike. */
export const UNEXPECTED_ANSWER =
  "We got an unexpected answer from our servers. Try again shortly.";

/** A problem with one field of the submitted form, shown next to it. */
type ProxyFieldError = {
  readonly field: string;
  readonly message: string;
};

export type ProxyError = {
  readonly code: ProxyErrorCode;
  readonly message: string;
  readonly fields?: readonly ProxyFieldError[];
};

export type ProxyBody<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: ProxyError };
