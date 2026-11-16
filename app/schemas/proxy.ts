/**
 * The JSON body a resource route answers a script's form post with
 * (`sendForm`; the theme route), and the errors `api.server.ts` gives its
 * callers. `message` is always the app's own copy, never the API's, in one
 * voice ("We couldn’t…").
 */

/**
 * Every `code` an error body can carry: the API's codes a page treats
 * differently; `try_again` for every other failure (an outage, a timeout,
 * a 5xx, an answer nobody can read); the theme route's (a choice it
 * doesn't know, a method it doesn't take); the CSRF check's; and the
 * browser's own (`sendForm`: offline).
 */
export type ProxyErrorCode =
  | "unauthenticated"
  | "user_blocked"
  | "conflict"
  | "turnstile_failed"
  | "invalid_request"
  | "try_again"
  | "invalid_theme"
  | "method_not_allowed"
  | "forbidden"
  | "offline";

/** The copy for `try_again`: whatever went wrong, trying again is the answer. */
export const TRY_AGAIN_MESSAGE =
  "We couldn’t do that just now. Try again shortly.";

export type ProxyError = {
  readonly code: ProxyErrorCode;
  readonly message: string;
};

export type ProxyBody<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: ProxyError };
