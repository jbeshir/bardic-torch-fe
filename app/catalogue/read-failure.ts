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
 * - `not_found`: a detail or history read's 404, or its 400 (the route
 *   checked the address first, so a 400 means the app and the API
 *   disagree, and is logged as such), or an address the route refused
 *   without calling. The page answers 404.
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

/** An error answer: its status and the Error body's code, if any. */
type Answer = {
  readonly status: number;
  /** The Error body's code; undefined when the body isn't an Error. */
  readonly code: UpstreamErrorCode | undefined;
};

/** What the read client saw: an error answer, or no answer at all. */
type Upstream = Answer | "unreachable";

type Resting = Extract<ReadFailure, { readonly kind: "resting" }>;

/** A contract break: the answer the app couldn't read. */
export const BAD_GATEWAY: { readonly kind: "bad_gateway" } = {
  kind: "bad_gateway",
};

/** An address that names nothing public: the page answers 404. */
export const NOT_FOUND: { readonly kind: "not_found" } = { kind: "not_found" };

const SERVER: { readonly kind: "server" } = { kind: "server" };
const SEARCH_TIMEOUT: { readonly kind: "search_timeout" } = {
  kind: "search_timeout",
};

/**
 * Resting for no answer (`Retry-After` 30), a 503 or `unavailable` (60);
 * any other answer as `answered` reads it.
 */
function classify<Failure extends ReadFailure>(
  upstream: Upstream,
  answered: (answer: Answer) => Failure
): Failure | Resting {
  if (upstream === "unreachable") {
    return { kind: "resting", retryAfter: RETRY_AFTER_UNREACHABLE };
  }
  if (upstream.status === 503 || upstream.code === "unavailable") {
    return { kind: "resting", retryAfter: RETRY_AFTER_UNAVAILABLE };
  }
  return answered(upstream);
}

/** Whether `answer` is the spec's `status` with `code`. */
function is(answer: Answer, status: number, code: UpstreamErrorCode): boolean {
  return answer.status === status && answer.code === code;
}

/** `failure` for the declared 500 `internal`; any other answer breaks the contract. */
function internal<Failure extends ReadFailure>(
  answer: Answer,
  failure: Failure
): Failure | typeof BAD_GATEWAY {
  return is(answer, 500, "internal") ? failure : BAD_GATEWAY;
}

/**
 * The failure for an upstream error answer (or none) of a search op
 * (listPieces, listPersons, listCollections). `filtered`: the
 * request had `q` or a filter (`letter`, `sort` and paging don't count).
 */
export function searchFailure(
  upstream: Upstream,
  { filtered }: { readonly filtered: boolean }
): ReadFailure {
  return classify(upstream, answer =>
    is(answer, 400, "invalid_request")
      ? { kind: "invalid_filters" }
      : internal(answer, filtered ? SEARCH_TIMEOUT : SERVER)
  );
}

/**
 * The failure for an error answer (or none) of a list op that isn't a
 * search (listTerms, listEvents): its 500 is a plain server error, and its
 * 400 can only mean the app and the API disagree, since the loader sends
 * only values it has checked, so it is an answer we can't use (502).
 */
export function listFailure(upstream: Upstream): PageFailure {
  return classify(upstream, answer => internal(answer, SERVER));
}

/**
 * The failure for an error answer (or none) of a detail or history op
 * (getPiece, getPerson, getTerm, getCollection, getEvent, the history
 * lists, getRevision): a 404 `not_found` is the entity's 404, and so is
 * a 400 `invalid_request`: the loader checked the address first, so the
 * API disagrees with the app's rule (the read client has logged it), and
 * the address still leads nowhere.
 */
export function detailFailure(upstream: Upstream): PageFailure {
  return classify(upstream, answer =>
    is(answer, 404, "not_found") || is(answer, 400, "invalid_request")
      ? NOT_FOUND
      : internal(answer, SERVER)
  );
}

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

/**
 * The page failure for a read the page can't show without: a filter
 * failure there (a read with no filters, or one the page doesn't offer
 * to change) can only mean the app and the API disagree, an answer the
 * page can't use (502).
 */
export function asPageFailure(failure: ReadFailure): PageFailure {
  return isPageFailure(failure) ? failure : { kind: "bad_gateway" };
}
