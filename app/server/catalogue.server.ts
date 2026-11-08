import type { RouterContextProvider } from "react-router";
import type { z } from "zod";
import type { operations } from "~/api/schema.gen";
import {
  BAD_GATEWAY,
  searchFailure,
  type ReadFailure,
} from "~/catalogue/read-failure";
import { upstreamErrorSchema } from "~/schemas/api";
import {
  pieceListSchema,
  type ApiQuery,
  type PieceList,
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
 * (checked against the spec), and a typed function below.
 */

type ReadResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly failure: ReadFailure };

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

/**
 * Where each catalogue read lives, and its query parameters in the order
 * they are sent (the spec's). The compiler checks each path against the
 * spec and each name against the operation's query.
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
  },
} as const satisfies {
  readonly [Id in keyof operations]?: EndpointOf<operations[Id]> & {
    readonly query: readonly (keyof NonNullable<
      operations[Id]["parameters"]["query"]
    >)[];
  };
};

type ReadId = keyof typeof ENDPOINTS;

type QueryValue = string | number | boolean | readonly string[] | undefined;

/**
 * The query string for `query` (with its "?", or "" when empty), in the
 * operation's parameter order: arrays as repeated keys (form, explode),
 * booleans as `true`/`false`, numbers in decimal. Undefined values and
 * empty arrays are left out, and a scalar is never sent twice.
 */
function queryString<Id extends ReadId>(
  operationId: Id,
  query: ApiQuery<Id>
): string {
  const params = new URLSearchParams();
  const values: Readonly<Record<string, QueryValue>> = query;
  for (const name of ENDPOINTS[operationId].query) {
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

async function callPublicApi<Id extends ReadId, T>(
  context: Readonly<RouterContextProvider>,
  operationId: Id,
  query: ApiQuery<Id>,
  schema: z.ZodType<T>
): Promise<ReadResult<T>> {
  const env = context.get(appEnvContext);
  const url = `${upstreamUrl(env.BARDIC_TORCH_API_BASE_URL, ENDPOINTS[operationId].path)}${queryString(operationId, query)}`;
  const filtered = isFiltered(query);

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
    return { ok: false, failure: searchFailure("unreachable", { filtered }) };
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
    failure: searchFailure(
      { status: response.status, code: error.data?.code },
      { filtered }
    ),
  };
}

/** A page of pieces with the facet counts (`GET /v1/pieces`). */
export function listPieces(
  context: Readonly<RouterContextProvider>,
  query: ApiQuery<"listPieces">
): Promise<ReadResult<PieceList>> {
  return callPublicApi(context, "listPieces", query, pieceListSchema);
}
