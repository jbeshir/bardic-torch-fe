import type { RouterContextProvider } from "react-router";
import type { operations } from "~/api/schema.gen";
import {
  failureForStatus,
  TRY_AGAIN,
  type ReadFailure,
} from "~/catalogue/read-failure";
import type { UpstreamErrorCode } from "~/schemas/api";
import {
  type ApiQuery,
  type Collection,
  type CollectionList,
  type Event,
  type EventList,
  type Person,
  type PersonList,
  type Piece,
  type PieceList,
  type Revision,
  type RevisionHistory,
  type Term,
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
 * Each call parses the body as the spec's response type (not validated at
 * runtime; a body that is not JSON is a failure to try again) and resolves to a `ReadResult`;
 * nothing throws. A failed call is a `ReadFailure` (read-failure.ts): a 404 is
 * a not found, anything else a read to try again. The API's `message` is
 * logged, never shown.
 *
 * Add an operation with the page that first calls it: an `ENDPOINTS` entry
 * (checked against the spec), and a typed function below.
 */

export type ReadResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly failure: ReadFailure };

/**
 * Where each catalogue read lives and its query parameters in the order
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
  // The facet column, search, the bards directory and
  // the categories.
  listTerms: {
    method: "GET",
    path: "/v1/terms",
    query: ["facet"],
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
  },
  // The piece page and the bard page.
  getPiece: {
    method: "GET",
    path: "/v1/pieces/{slug}",
    query: [],
  },
  getPerson: {
    method: "GET",
    path: "/v1/persons/{slug}",
    query: [],
  },
  // A category, collections and events.
  getTerm: {
    method: "GET",
    path: "/v1/terms/{slug}",
    query: ["limit", "offset"],
  },
  listCollections: {
    method: "GET",
    path: "/v1/collections",
    query: ["kind", "letter", "limit", "offset"],
  },
  getCollection: {
    method: "GET",
    path: "/v1/collections/{collection_id}",
    query: [],
  },
  listEvents: {
    method: "GET",
    path: "/v1/events",
    query: ["kind", "limit", "offset"],
  },
  getEvent: {
    method: "GET",
    path: "/v1/events/{slug}",
    query: [],
  },
  // Histories and revisions.
  listPieceRevisions: {
    method: "GET",
    path: "/v1/pieces/{slug}/history",
    query: ["limit", "offset"],
  },
  listPersonRevisions: {
    method: "GET",
    path: "/v1/persons/{slug}/history",
    query: ["limit", "offset"],
  },
  listTermRevisions: {
    method: "GET",
    path: "/v1/terms/{slug}/history",
    query: ["limit", "offset"],
  },
  listCollectionRevisions: {
    method: "GET",
    path: "/v1/collections/{collection_id}/history",
    query: ["limit", "offset"],
  },
  listEventRevisions: {
    method: "GET",
    path: "/v1/events/{slug}/history",
    query: ["limit", "offset"],
  },
  getRevision: {
    method: "GET",
    path: "/v1/revisions/{revision_id}",
    query: [],
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

/**
 * One read: `query` in the operation's order, and `path` filling the
 * path's `{name}`s (already checked by the loader, percent-encoded here).
 */
async function callPublicApi<Id extends ReadId, T>(
  context: Readonly<RouterContextProvider>,
  operationId: Id,
  {
    query,
    path,
  }: {
    readonly query?: ApiQuery<Id>;
    readonly path?: Readonly<Record<string, string>>;
  }
): Promise<ReadResult<T>> {
  const env = context.get(appEnvContext);
  const url = `${upstreamUrl(env.BARDIC_TORCH_API_BASE_URL, ENDPOINTS[operationId].path, path)}${queryString(operationId, query)}`;

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
    return { ok: false, failure: TRY_AGAIN };
  }

  const payload = parseJson(text);
  const body =
    typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : undefined;
  if (response.ok) {
    if (body) return { ok: true, data: body as T };
    console.error(`${operationId} answered a body that is not a JSON object`);
    return { ok: false, failure: TRY_AGAIN };
  }
  if (response.status < 400) {
    console.error(`${operationId} answered ${response.status}`);
    return { ok: false, failure: TRY_AGAIN };
  }
  const code =
    typeof body?.code === "string"
      ? (body.code as UpstreamErrorCode)
      : undefined;
  console.error(
    `${operationId} answered ${response.status}:`,
    code === undefined ? "no Error body" : `${code}: ${String(body?.message)}`
  );
  return { ok: false, failure: failureForStatus(response.status) };
}

/** A page of pieces with the facet counts (`GET /v1/pieces`). */
export function listPieces(
  context: Readonly<RouterContextProvider>,
  query: ApiQuery<"listPieces">
): Promise<ReadResult<PieceList>> {
  return callPublicApi(context, "listPieces", { query });
}

/**
 * The public term tree, or one facet's, in tree order (`GET /v1/terms`):
 * the facet column's labels and tree, search's categories and the bards
 * directory's affiliations, and /categories.
 */
export function listTerms(
  context: Readonly<RouterContextProvider>,
  query: ApiQuery<"listTerms">
): Promise<ReadResult<TermList>> {
  return callPublicApi(context, "listTerms", { query });
}

/** A page of persons with their letter counts (`GET /v1/persons`). */
export function listPersons(
  context: Readonly<RouterContextProvider>,
  query: ApiQuery<"listPersons">
): Promise<ReadResult<PersonList>> {
  return callPublicApi(context, "listPersons", { query });
}

/** A piece, with everything its page shows (`GET /v1/pieces/{slug}`). */
export function getPiece(
  context: Readonly<RouterContextProvider>,
  slug: string
): Promise<ReadResult<Piece>> {
  return callPublicApi(context, "getPiece", { path: { slug } });
}

/** A person, with everything their page shows (`GET /v1/persons/{slug}`). */
export function getPerson(
  context: Readonly<RouterContextProvider>,
  slug: string
): Promise<ReadResult<Person>> {
  return callPublicApi(context, "getPerson", { path: { slug } });
}

// ---------------------------------------------------------------------------
// Categories, collections, events, histories and revisions

/**
 * A term with one page of its members (`GET /v1/terms/{slug}`): `slug`
 * already checked with `isSlug`.
 */
export function getTerm(
  context: Readonly<RouterContextProvider>,
  slug: string,
  query: ApiQuery<"getTerm">
): Promise<ReadResult<Term>> {
  return callPublicApi(context, "getTerm", { query, path: { slug } });
}

/** A page of collections by sort name (`GET /v1/collections`). */
export function listCollections(
  context: Readonly<RouterContextProvider>,
  query: ApiQuery<"listCollections">
): Promise<ReadResult<CollectionList>> {
  return callPublicApi(context, "listCollections", { query });
}

/**
 * A collection with its citations (`GET /v1/collections/{collection_id}`):
 * `id` already checked with `isEntityId`, and sent as written, since an
 * int64 may not fit a JavaScript number.
 */
export function getCollection(
  context: Readonly<RouterContextProvider>,
  id: string
): Promise<ReadResult<Collection>> {
  return callPublicApi(context, "getCollection", {
    path: { collection_id: id },
  });
}

/** A page of events and venues by name (`GET /v1/events`). */
export function listEvents(
  context: Readonly<RouterContextProvider>,
  query: ApiQuery<"listEvents">
): Promise<ReadResult<EventList>> {
  return callPublicApi(context, "listEvents", { query });
}

/**
 * An event or venue with its performances (`GET /v1/events/{slug}`):
 * `slug` already checked with `isSlug`.
 */
export function getEvent(
  context: Readonly<RouterContextProvider>,
  slug: string
): Promise<ReadResult<Event>> {
  return callPublicApi(context, "getEvent", { path: { slug } });
}

/**
 * Each entity with a history, by its history operation and the name of
 * its address in the path.
 */
const HISTORIES = {
  piece: { operationId: "listPieceRevisions", address: "slug" },
  person: { operationId: "listPersonRevisions", address: "slug" },
  term: { operationId: "listTermRevisions", address: "slug" },
  collection: {
    operationId: "listCollectionRevisions",
    address: "collection_id",
  },
  event: { operationId: "listEventRevisions", address: "slug" },
} as const satisfies Readonly<
  Record<string, { readonly operationId: ReadId; readonly address: string }>
>;

export type HistoryEntity = keyof typeof HISTORIES;

/**
 * A page of an entity's approved revisions, newest first (`GET
 * /v1/{pieces|persons|terms|collections|events}/{address}/history`):
 * `address` already checked by the route (a slug, or a collection id as
 * written).
 */
export function listRevisions(
  context: Readonly<RouterContextProvider>,
  entity: HistoryEntity,
  address: string,
  query: { readonly limit: number; readonly offset: number }
): Promise<ReadResult<RevisionHistory>> {
  const { operationId, address: name } = HISTORIES[entity];
  return callPublicApi(context, operationId, {
    query,
    path: { [name]: address },
  });
}

/**
 * A revision with its snapshot and its base's (`GET /v1/revisions/{id}`):
 * `id` already checked with `isEntityId`, and sent as written.
 */
export function getRevision(
  context: Readonly<RouterContextProvider>,
  id: string
): Promise<ReadResult<Revision>> {
  return callPublicApi(context, "getRevision", { path: { revision_id: id } });
}
