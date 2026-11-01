/**
 * The JSON body of every `/api/*` proxy response (`proxyResponse` in
 * api.server.ts), as the settings page's fetchers read it. `message` is
 * always the app's own copy, never the API's.
 */

/** A problem with one field of the submitted form, shown next to it. */
type ProxyFieldError = {
  readonly field: string;
  readonly message: string;
};

export type ProxyError = {
  readonly code: string;
  readonly message: string;
  readonly fields?: readonly ProxyFieldError[];
};

export type ProxyBody<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: ProxyError };
