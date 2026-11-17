import type { HeadersFunction } from "react-router";

/**
 * Every catalogue route's `headers` export (plan §3.3). A route with its
 * own `headers` replaces what it would inherit, so this one passes on the
 * root's `Cache-Control` (`no-store` while signed in; unset, the answer is
 * private and revalidated) and adds the `Retry-After` of a thrown failure
 * (`errorHeaders`, the resting page), as `throwPageFailure` set it.
 */
export const catalogueHeaders: HeadersFunction = ({
  parentHeaders,
  errorHeaders,
}) => {
  const headers = new Headers();
  const cacheControl = parentHeaders.get("Cache-Control");
  if (cacheControl) headers.set("Cache-Control", cacheControl);
  const retryAfter = errorHeaders?.get("Retry-After");
  if (retryAfter) headers.set("Retry-After", retryAfter);
  return headers;
};
