import { useEffect, useRef } from "react";
import { OFFLINE } from "~/client/send-form";
import { useBrowserLayoutEffect } from "~/hooks/useBrowserLayoutEffect";
import type { ProxyBody, ProxyError, ProxyErrorCode } from "~/schemas/proxy";

/**
 * Calls `onResult` once for each result a fetcher gets back, after any
 * revalidation it triggered has finished (so the page already shows the
 * new data when, say, focus moves). The settings route's `clientAction`
 * (`sendForm`) turns every outcome into a proxy body, so every request
 * ends here.
 */
export function useFetcherResult<Result extends ProxyBody<unknown>>(
  fetcher: { readonly state: string; readonly data: Result | undefined },
  onResult: (result: Result) => void
): void {
  const handledRef = useRef<unknown>(null);
  const latestRef = useRef(onResult);
  useBrowserLayoutEffect(() => {
    latestRef.current = onResult;
  });
  const { state, data } = fetcher;
  useEffect(() => {
    if (state !== "idle" || data === undefined || handledRef.current === data) {
      return;
    }
    handledRef.current = data;
    latestRef.current(data);
  }, [state, data]);
}

/** The message for one form field, when the failure was about it. */
export function fieldMessage(error: ProxyError, field: string): string | null {
  return (
    error.fields?.find(problem => problem.field === field)?.message ?? null
  );
}

/** Failures that are the service's, not the request's. */
const SERVICE_TROUBLE: ReadonlySet<ProxyErrorCode> = new Set<ProxyErrorCode>([
  "internal",
  "unavailable",
  "bad_gateway",
  "upstream_unavailable",
  "unexpected_response",
  OFFLINE.code,
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
