import { data, isRouteErrorResponse } from "react-router";

/**
 * Why a catalogue read failed, as the pages see it: the address names
 * nothing (a 404 from the API), or the read is worth trying again (an
 * outage, a 5xx, a timeout, a network failure, a 400, or an answer the
 * app can't read). The API's `message` is logged, never shown. Catalogue
 * reads are anonymous, so none can be signed out.
 */
export type ReadFailure =
  { readonly kind: "not_found" } | { readonly kind: "try_again" };

/** An address that names nothing public: the page answers 404. */
export const NOT_FOUND: ReadFailure = { kind: "not_found" };

/** A read to try again: the page answers 503 with `Retry-After`. */
export const TRY_AGAIN: ReadFailure = { kind: "try_again" };

/** Seconds a reader should wait before trying again. */
const RETRY_AFTER = 30;

/** The failure for an upstream error answer: only a 404 is a not found. */
export function failureForStatus(status: number): ReadFailure {
  return status === 404 ? NOT_FOUND : TRY_AGAIN;
}

/**
 * End a loader with a failure: its route's ErrorBoundary shows it
 * (`CatalogueError`), with the status and the `Retry-After` that
 * `catalogueHeaders` sends on.
 */
export function throwPageFailure(failure: ReadFailure): never {
  throw data(
    failure,
    failure.kind === "not_found"
      ? { status: 404 }
      : { status: 503, headers: { "Retry-After": String(RETRY_AFTER) } }
  );
}

/**
 * The failure a loader threw with `throwPageFailure`, read back from the
 * route's error; null for anything else.
 */
export function thrownPageFailure(error: unknown): ReadFailure | null {
  if (!isRouteErrorResponse(error)) return null;
  const body: unknown = error.data;
  if (typeof body !== "object" || body === null || !("kind" in body)) {
    return null;
  }
  switch (body.kind) {
    case "not_found":
      return NOT_FOUND;
    case "try_again":
      return TRY_AGAIN;
    default:
      return null;
  }
}
