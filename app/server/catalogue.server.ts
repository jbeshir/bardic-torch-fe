import type { RouterContextProvider } from "react-router";
import type { z } from "zod";
import type { operations } from "~/api/schema.gen";
import {
  BAD_GATEWAY,
  detailFailure,
  listFailure,
  searchFailure,
  type PageFailure,
  type ReadFailure,
} from "~/catalogue/read-failure";
import { upstreamErrorSchema } from "~/schemas/api";
import {
  personListSchema,
  personSchema,
  pieceListSchema,
  pieceSchema,
  type ApiQuery,
  type Person,
  type PersonList,
  type Piece,
  type PieceList,
  termListSchema,
  type TermList,
} from "~/schemas/catalogue";
import { appEnvContext } from "./context.server";
import {
  aborted,
  type EndpointOf,
  isTimeout,
  parseJson,
  UPSTREAM_TIMEOUT_MS,
  upstreamUrl,
} from "./upstream.server";

/**
 * The anonymous read client for the catalogue (plan §3.2). Every catalogue
 * read is public (`security: []`) and the API ignores credentials on it, so
 * this client never looks at the session: it sends no Authorization and no
 * cookie, never refreshes a token and sets no header on the page's answer.
 * That keeps a catalogue page the same whoever is reading it.
 *
 * Each call validates the body with zod and resolves to a `ReadResult`;
 * nothing throws. A failed call is a `ReadFailure` (read-failure.ts), with
 * the API's `message` logged, never shown.
 *
 * Add an operation with the page that first calls it: an `ENDPOINTS` entry
 * (checked against the spec), and a typed function below. Each entry says
 * how its error answers read (`reads`): a search's 500 may be a slow
 * search and its 400 a stale filter (`searchFailure`); another list's are
 * a server error and a contract break (`listFailure`); a detail read's 404
 * (or 400) is the entity's 404 (`detailFailure`), and every failure of a
 * detail read is a `PageFailure`.
 */

type ReadResult<T, Failure extends ReadFailure = ReadFailure> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly failure: Failure };

/**
 * Query parameters that only page or order a search, so a 500 for a
 * request with nothing else is a plain server error, not a slow search.
 */
const NOT_FILTERS: ReadonlySet<string> = new Set([
  "letter",
  "sort",
  "limit",
  "offset",
]);

/** How an operation's error answers map to a `ReadFailure`. */
type Reads = "search" | "list" | "detail";

/**
 * Where each catalogue read lives, its query parameters in the order they
 * are sent (the spec's), and how its failures read. The compiler checks
 * each path against the spec and each name against the operation's query.
 */
const ENDPOINTS = {
  listPieces: {
    method: "GET",
    path: "/v1/pieces",
    query: [
      "term",
      "kind",
      "conservation_status",
      "stub",
      "q",
      "letter",
      "sort",
      "limit",
      "offset",
    ],
    reads: "search",
  },
  // The facet column (C2.2), search (C3.1) and the bards directory (C5.2).
  listTerms: {
    method: "GET",
    path: "/v1/terms",
    query: ["facet"],
    reads: "list",
  },
  listPersons: {
    method: "GET",
    path: "/v1/persons",
    query: [
      "kind",
      "role",
      "affiliation",
      "q",
      "letter",
      "sort",
      "limit",
      "offset",
    ],
    reads: "search",
  },
  // The piece page (C4.1) and the bard page (C5.1).
  getPiece: {
    method: "GET",
    path: "/v1/pieces/{slug}",
    query: [],
    reads: "detail",
  },
  getPerson: {
    method: "GET",
    path: "/v1/persons/{slug}",
    query: [],
    reads: "detail",
  },
} as const satisfies {
  readonly [Id in keyof operations]?: EndpointOf<operations[Id]> & {
    readonly query: readonly (keyof NonNullable<
      operations[Id]["parameters"]["query"]
    >)[];
    readonly reads: Reads;
  };
};

type ReadId = keyof typeof ENDPOINTS;

type QueryValue = string | number | boolean | readonly string[] | undefined;

/** What a read of `Id` can fail with: a detail read's are page failures. */
type FailureOf<Id extends ReadId> =
  (typeof ENDPOINTS)[Id]["reads"] extends "detail" ? PageFailure : ReadFailure;

/**
 * The query string for `query` (with its "?", or "" when empty), in the
 * operation's parameter order: arrays as repeated keys (form, explode),
 * booleans as `true`/`false`, numbers in decimal. Undefined values and
 * empty arrays are left out, and a scalar is never sent twice.
 */
function queryString<Id extends ReadId>(
  operationId: Id,
  query: ApiQuery<Id> | undefined
): string {
  const params = new URLSearchParams();
  const values: Readonly<Record<string, QueryValue>> = query ?? {};
  const names: readonly string[] = ENDPOINTS[operationId].query;
  for (const name of names) {
    const value = values[name];
    if (value === undefined) continue;
    if (typeof value === "object") {
      for (const item of value) params.append(name, item);
    } else {
      params.set(name, String(value));
    }
  }
  const search = params.toString();
  return search ? `?${search}` : "";
}

/** Whether `query` has `q` or a filter, not only letter, sort and paging. */
function isFiltered(query: Readonly<Record<string, QueryValue>>): boolean {
  return Object.entries(query).some(
    ([name, value]) =>
      !NOT_FILTERS.has(name) &&
      value !== undefined &&
      (typeof value !== "object" || value.length > 0)
  );
}

/** The `ReadFailure` for an error answer (or none) of `operationId`. */
function failureOf(
  operationId: ReadId,
  upstream: Parameters<typeof listFailure>[0],
  filtered: boolean
): ReadFailure {
  switch (ENDPOINTS[operationId].reads) {
    case "search":
      return searchFailure(upstream, { filtered });
    case "list":
      return listFailure(upstream);
    case "detail":
      return detailFailure(upstream);
  }
}

/**
 * One read: `query` in the operation's order, and `path` filling the
 * path's `{name}`s (already checked by the loader, percent-encoded here).
 * A detail read fails only with a `PageFailure` (`FailureOf`).
 */
function callPublicApi<Id extends ReadId, T>(
  context: Readonly<RouterContextProvider>,
  operationId: Id,
  request: {
    readonly query?: ApiQuery<Id>;
    readonly path?: Readonly<Record<string, string>>;
  },
  schema: z.ZodType<T>
): Promise<ReadResult<T, FailureOf<Id>>>;
async function callPublicApi<Id extends ReadId, T>(
  context: Readonly<RouterContextProvider>,
  operationId: Id,
  {
    query,
    path,
  }: {
    readonly query?: ApiQuery<Id>;
    readonly path?: Readonly<Record<string, string>>;
  },
  schema: z.ZodType<T>
): Promise<ReadResult<T>> {
  const env = context.get(appEnvContext);
  const url = `${upstreamUrl(env.BARDIC_TORCH_API_BASE_URL, ENDPOINTS[operationId].path, path)}${queryString(operationId, query)}`;
  const filtered = isFiltered(query ?? {});

  // The timeout covers the body too: a body that stalls or breaks off
  // ends like a request that never got an answer.
  const signal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
  let response: Response;
  let text: string;
  try {
    response = await fetch(url, {
      method: ENDPOINTS[operationId].method,
      headers: { Accept: "application/json" },
      redirect: "manual",
      signal,
    });
    text = await Promise.race([response.text(), aborted(signal)]);
  } catch (error) {
    console.error(
      `${operationId} ${isTimeout(error) ? "timed out" : "failed"}:`,
      error
    );
    return {
      ok: false,
      failure: failureOf(operationId, "unreachable", filtered),
    };
  }

  const payload = parseJson(text);
  if (response.ok) {
    const parsed = schema.safeParse(payload);
    if (parsed.success) return { ok: true, data: parsed.data };
    console.error(
      `${operationId} answered a body that breaks the contract:`,
      parsed.error.issues
    );
    return { ok: false, failure: BAD_GATEWAY };
  }
  if (response.status < 400) {
    console.error(`${operationId} answered ${response.status}`);
    return { ok: false, failure: BAD_GATEWAY };
  }
  const error = upstreamErrorSchema.safeParse(payload);
  console.error(
    `${operationId} answered ${response.status}:`,
    error.success
      ? `${error.data.code}: ${error.data.message}`
      : "no Error body"
  );
  return {
    ok: false,
    failure: failureOf(
      operationId,
      { status: response.status, code: error.data?.code },
      filtered
    ),
  };
}

/** A page of pieces with the facet counts (`GET /v1/pieces`). */
export function listPieces(
  context: Readonly<RouterContextProvider>,
  query: ApiQuery<"listPieces">
): Promise<ReadResult<PieceList>> {
  return callPublicApi(context, "listPieces", { query }, pieceListSchema);
}

/**
 * The public term tree, or one facet's, in tree order (`GET /v1/terms`):
 * the facet column's labels and tree, search's categories and the bards
 * directory's affiliations. Not a search, so a 500 is a plain server error.
 */
export function listTerms(
  context: Readonly<RouterContextProvider>,
  query: ApiQuery<"listTerms">
): Promise<ReadResult<TermList>> {
  return callPublicApi(context, "listTerms", { query }, termListSchema);
}

/** A page of persons with their letter counts (`GET /v1/persons`). */
export function listPersons(
  context: Readonly<RouterContextProvider>,
  query: ApiQuery<"listPersons">
): Promise<ReadResult<PersonList>> {
  return callPublicApi(context, "listPersons", { query }, personListSchema);
}

/** A piece, with everything its page shows (`GET /v1/pieces/{slug}`). */
export function getPiece(
  context: Readonly<RouterContextProvider>,
  slug: string
): Promise<ReadResult<Piece, PageFailure>> {
  return callPublicApi(context, "getPiece", { path: { slug } }, pieceSchema);
}

/** A person, with everything their page shows (`GET /v1/persons/{slug}`). */
export function getPerson(
  context: Readonly<RouterContextProvider>,
  slug: string
): Promise<ReadResult<Person, PageFailure>> {
  return callPublicApi(context, "getPerson", { path: { slug } }, personSchema);
}
