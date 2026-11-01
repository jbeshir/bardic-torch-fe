import { useEffect, useRef } from "react";
import type { ProxyBody, ProxyError } from "~/schemas/proxy";

/**
 * What a form is told when the response isn't a proxy body at all (say, a
 * 2xx page from something between us and the worker): the service's
 * trouble, so it shows its "we couldn't … try again" Alert.
 */
const MALFORMED_RESPONSE: ProxyError = {
  code: "bad_gateway",
  message: "Bardic Torch sent an unexpected response. Try again shortly.",
};

function isProxyBody(value: unknown): value is ProxyBody<unknown> {
  if (typeof value !== "object" || value === null) return false;
  const body = value as { ok?: unknown; data?: unknown; error?: unknown };
  if (body.ok === true) return "data" in body;
  if (body.ok !== false) return false;
  const error = body.error as { code?: unknown; message?: unknown } | null;
  return (
    typeof error === "object" &&
    error !== null &&
    typeof error.code === "string" &&
    typeof error.message === "string"
  );
}

/**
 * Calls `onResult` once for each response a fetcher gets back, after any
 * revalidation it triggered has finished (so the page already shows the
 * new data when, say, focus moves). A response that isn't a proxy body is
 * reported as a failure, so every request ends in feedback on the page.
 */
export function useFetcherResult<Result extends ProxyBody<unknown>>(
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
    latest.current(
      isProxyBody(data)
        ? data
        : ({ ok: false, error: MALFORMED_RESPONSE } as Result)
    );
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
