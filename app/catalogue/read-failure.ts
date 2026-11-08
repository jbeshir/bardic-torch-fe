import { data, isRouteErrorResponse } from "react-router";
import type { UpstreamErrorCode } from "~/schemas/api";

/**
 * Why a catalogue read failed, as the pages see it (plan §3.3): the read
 * client (`app/server/catalogue.server.ts`) maps every upstream answer to
 * one of these `kind`s, and the pages switch on the kind, never on the
 * API's status or `message` (which is logged, never shown).
 *
 * - `resting`: the API is down, unreachable or too slow (a 503 of any body,
 *   the Error code `unavailable`, a network failure or the timeout). The
 *   page answers 503 with `Retry-After`.
 * - `server`: a 500 the reader can only retry.
 * - `search_timeout`: a 500 from a search op (InternalSearch) for a request
 *   with `q` or a filter, which is most likely the 2 s search limit: a
 *   narrower search may succeed.
 * - `invalid_filters`: a list op's 400 `invalid_request`.
 * - `bad_gateway`: an answer that breaks the contract (a body zod rejects,
 *   not JSON, a redirect, an undeclared status or code).
 *
 * - `not_found`: a detail read's 404, or its 400 (the route checked the
 *   address first, so a 400 is a contract mismatch, logged), or an address
 *   the route refused without calling.
 */
export type ReadFailure =
  | {
      readonly kind: "resting";
      /** Seconds the reader should wait, for the `Retry-After` header. */
      readonly retryAfter: number;
    }
  | { readonly kind: "server" | "bad_gateway" | "not_found" }
  | { readonly kind: "search_timeout" | "invalid_filters" };

/**
 * A failure the page can't show around its own content, so the loader
 * throws it to the route's ErrorBoundary (`throwPageFailure`).
 */
export type PageFailure = Extract<
  ReadFailure,
  { readonly kind: "resting" | "server" | "bad_gateway" | "not_found" }
>;

/**
 * A failure of the filters or the search the reader asked for: the loader
 * returns it, so the page keeps its search box and filters to change them.
 */
export type FilterFailure = Exclude<ReadFailure, PageFailure>;

const STATUS: Readonly<Record<ReadFailure["kind"], number>> = {
  resting: 503,
  server: 500,
  bad_gateway: 502,
  not_found: 404,
  search_timeout: 500,
  invalid_filters: 400,
};

/** How long to wait after a 503 or an `unavailable` answer. */
const RETRY_AFTER_UNAVAILABLE = 60;
/** How long to wait after a network failure or a timeout. */
const RETRY_AFTER_UNREACHABLE = 30;

/** What the read client saw: an error answer, or no answer at all. */
type Upstream =
  | {
      readonly status: number;
      /** The Error body's code; undefined when the body isn't an Error. */
      readonly code: UpstreamErrorCode | undefined;
    }
  | "unreachable";

/**
 * The failure for an upstream error answer (or none) of a search op
 * (listPieces, and later listPersons and listCollections). `filtered`: the
 * request had `q` or a filter (`letter`, `sort` and paging don't count).
 */
export function searchFailure(
  upstream: Upstream,
  { filtered }: { readonly filtered: boolean }
): ReadFailure {
  if (upstream === "unreachable") {
    return { kind: "resting", retryAfter: RETRY_AFTER_UNREACHABLE };
  }
  const { status, code } = upstream;
  if (status === 503 || code === "unavailable") {
    return { kind: "resting", retryAfter: RETRY_AFTER_UNAVAILABLE };
  }
  if (status === 400 && code === "invalid_request") {
    return { kind: "invalid_filters" };
  }
  if (status === 500 && code === "internal") {
    return { kind: filtered ? "search_timeout" : "server" };
  }
  return { kind: "bad_gateway" };
}

/**
 * The failure for an error answer (or none) of a list op that isn't a
 * search (listTerms): its 500 is a plain server error, and its 400 can only
 * mean the app and the API disagree, since the loader sends only values it
 * has checked, so it is an answer we can't use (502).
 */
export function listFailure(upstream: Upstream): ReadFailure {
  if (upstream === "unreachable") {
    return { kind: "resting", retryAfter: RETRY_AFTER_UNREACHABLE };
  }
  const { status, code } = upstream;
  if (status === 503 || code === "unavailable") {
    return { kind: "resting", retryAfter: RETRY_AFTER_UNAVAILABLE };
  }
  if (status === 500 && code === "internal") return { kind: "server" };
  return { kind: "bad_gateway" };
}

/** An address that names nothing public: the page answers 404. */
export const NOT_FOUND: PageFailure = { kind: "not_found" };

/**
 * The failure for an upstream error answer (or none) of a detail read
 * (getPiece, getPerson). The route checked the address before calling, so
 * a 400 means the same as a 404 (the API says so); a 500 is a server error.
 */
export function detailFailure(upstream: Upstream): PageFailure {
  if (upstream === "unreachable") {
    return { kind: "resting", retryAfter: RETRY_AFTER_UNREACHABLE };
  }
  const { status, code } = upstream;
  if (status === 503 || code === "unavailable") {
    return { kind: "resting", retryAfter: RETRY_AFTER_UNAVAILABLE };
  }
  if (
    (status === 404 && code === "not_found") ||
    (status === 400 && code === "invalid_request")
  ) {
    return NOT_FOUND;
  }
  if (status === 500 && code === "internal") return { kind: "server" };
  return { kind: "bad_gateway" };
}

/** A contract break: the answer the app couldn't read. */
export const BAD_GATEWAY: PageFailure = { kind: "bad_gateway" };

/** The status and headers a page answers a failure with. */
export function failureInit(failure: ReadFailure): {
  readonly status: number;
  readonly headers: Headers;
} {
  const headers = new Headers();
  if (failure.kind === "resting") {
    headers.set("Retry-After", String(failure.retryAfter));
  }
  return { status: STATUS[failure.kind], headers };
}

export function isPageFailure(failure: ReadFailure): failure is PageFailure {
  return (
    failure.kind === "resting" ||
    failure.kind === "server" ||
    failure.kind === "bad_gateway" ||
    failure.kind === "not_found"
  );
}

/**
 * End a loader with a page failure: its route's ErrorBoundary shows it
 * (`CatalogueError`), with the failure's status and `Retry-After`, which
 * `catalogueHeaders` sends on.
 */
export function throwPageFailure(failure: PageFailure): never {
  throw data(failure, failureInit(failure));
}

/**
 * The page failure a loader threw (`data(failure, failureInit(failure))`),
 * read back from the route's error; null for anything else.
 */
export function thrownPageFailure(error: unknown): PageFailure | null {
  if (!isRouteErrorResponse(error)) return null;
  const body: unknown = error.data;
  if (typeof body !== "object" || body === null || !("kind" in body)) {
    return null;
  }
  switch (body.kind) {
    case "resting":
      return {
        kind: "resting",
        retryAfter:
          "retryAfter" in body && typeof body.retryAfter === "number"
            ? body.retryAfter
            : RETRY_AFTER_UNAVAILABLE,
      };
    case "server":
    case "bad_gateway":
    case "not_found":
      return { kind: body.kind };
    default:
      return null;
  }
}
