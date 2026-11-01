import { useEffect, useRef } from "react";
import type { ProxyError } from "~/schemas/proxy";

/**
 * Calls `onResult` once for each response a fetcher gets back, after any
 * revalidation it triggered has finished (so the page already shows the
 * new data when, say, focus moves).
 */
export function useFetcherResult<Result>(
  fetcher: { readonly state: string; readonly data: Result | undefined },
  onResult: (result: Result) => void
): void {
  const handled = useRef<unknown>(null);
  const latest = useRef(onResult);
  latest.current = onResult;
  const { state, data } = fetcher;
  useEffect(() => {
    if (state !== "idle" || data === undefined || handled.current === data) {
      return;
    }
    handled.current = data;
    latest.current(data);
  }, [state, data]);
}

/** The message for one form field, when the failure was about it. */
export function fieldMessage(error: ProxyError, field: string): string | null {
  return (
    error.fields?.find(problem => problem.field === field)?.message ?? null
  );
}

/** Failures that are the service's, not the request's. */
const SERVICE_TROUBLE = new Set([
  "internal",
  "unavailable",
  "bad_gateway",
  "upstream_unavailable",
]);

/**
 * What to tell the reader about a failed call: the proxy's own copy when
 * it says something specific (blocked, the token limit, a token already
 * gone, signed out), or `fallback`, the form's "we couldn't … try again",
 * when the service itself had trouble.
 */
export function problemMessage(error: ProxyError, fallback: string): string {
  return SERVICE_TROUBLE.has(error.code) ? fallback : error.message;
}
