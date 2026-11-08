import type { components } from "../../app/api/schema.gen";
import {
  CATALOGUE_READS,
  isCatalogueRead,
  parseCatalogueRequest,
  type CatalogueReadId,
  type TermFacet,
} from "./catalogue/query";
import { SAMPLE_TOKENS, SEED_USERS, type SeedUserId } from "./data";
import {
  errorBody,
  OPERATIONS,
  type FixtureOperation,
  type FixtureOperationId,
  type FixtureResponse,
  type UserState,
} from "./operations";
import { responseProblems, specRoute } from "./spec";

/**
 * Routes a request to the operation table or to the `/__fixtures` control
 * endpoints. All state belongs to one fixture user, identified by the bearer
 * the app sends for a stub session: exactly `Bearer auth0|fixture:<userId>`.
 * Anything else is unauthenticated. Tests and Playwright workers that create
 * their own user never interfere with each other.
 *
 * - `POST /__fixtures/users {role?, display_name?, tokens?: "sample"|"none",
 *   blocked?}` → 201 `{id}`: an isolated user, with the sample tokens unless
 *   "none"; a blocked user gets 403 `user_blocked` from every operation.
 * - `POST /__fixtures/fail {operationId, status, code?, times?, userId?,
 *   match?}` → 204: the next `times` (default 1) calls of the operation fail
 *   with `status` and `code`, which must be a pair the spec allows for it.
 *   An authenticated operation fails for `userId` only. `match` is an
 *   object of path or query parameters (`{slug: "e2e-500-a1"}`): only a
 *   request whose parameters include every pair fails. On a state created
 *   with `requireMatch` (the Node server, which parallel e2e workers share)
 *   a public operation's failure needs a `match`.
 * - `POST /__fixtures/outage {operationId, match?, times?, mode: "503" |
 *   "html-502"}` → 204: the next matching `times` calls of a public
 *   operation answer what a proxy in front of the backend would (dokku, or
 *   Cloudflare): a plain-text 503 or an HTML 502. `match` is as for `fail`.
 *
 * Public catalogue reads are parsed strictly first (catalogue/query.ts), so
 * an invalid one answers 400 as the backend does. One the operation table
 * doesn't serve is still parsed and can still fail or have an outage; a
 * valid request to it answers 404 "no such route".
 *
 * A path parameter containing `/` (a raw `%2F`), or not validly
 * percent-encoded, matches no route: 404 "no such route".
 *
 * Every operation response is validated against the spec; a fixture that
 * breaks the contract throws instead of answering. Outages are the one
 * exception: they are deliberately outside the spec.
 */

type ErrorCode = components["schemas"]["Error"]["code"];

/** An operation the router routes: one the table serves, or a public read. */
type RoutedId = FixtureOperationId | CatalogueReadId;

type Match = Readonly<Record<string, string>>;

type PublicOperation = Extract<FixtureOperation, { authenticated: false }>;
type AuthenticatedOperation = Extract<
  FixtureOperation,
  { authenticated: true }
>;

type Failure = {
  readonly operationId: RoutedId;
  /** The user it fails for; empty for a public operation. */
  readonly owner: string;
  readonly match: Match;
  readonly status: number;
  readonly code: ErrorCode;
  readonly remaining: number;
};

type OutageMode = "503" | "html-502";

type Outage = {
  readonly operationId: RoutedId;
  readonly match: Match;
  readonly mode: OutageMode;
  readonly remaining: number;
};

export type FixtureState = {
  users: Map<string, UserState>;
  /** Keyed by owner, operation and match: a repeat replaces it. */
  failures: Map<string, Failure>;
  outages: Map<string, Outage>;
  /** Whether a public operation's failure or outage needs a `match`. */
  readonly requireMatch: boolean;
  sequence: number;
};

type FixtureRequest = {
  readonly method: string;
  readonly pathname: string;
  /** The raw query string, `?…` or empty (`URL.search`). */
  readonly search: string;
  readonly authorization: string | null;
  readonly contentType: string | null;
  readonly body: string;
};

const BEARER = /^Bearer auth0\|fixture:([a-z0-9][a-z0-9-]{0,63})$/;
/** The backend rejects request bodies above 16 KiB. */
const MAX_BODY_BYTES = 16 * 1024;
const INVALID_JSON = Symbol("invalid JSON");
/** The fixture serves no terms, so every term and affiliation is unknown. */
const NO_PUBLIC_TERMS: TermFacet = () => undefined;

const NO_SUCH_ROUTE: FixtureResponse = {
  status: 404,
  body: errorBody("not_found", "no such route"),
};

const OUTAGE_RESPONSES: Readonly<Record<OutageMode, FixtureResponse>> = {
  "503": {
    status: 503,
    contentType: "text/plain; charset=utf-8",
    body: "503 Service Unavailable\n",
  },
  "html-502": {
    status: 502,
    contentType: "text/html; charset=utf-8",
    body: "<html>\n<head><title>502 Bad Gateway</title></head>\n<body>\n<center><h1>502 Bad Gateway</h1></center>\n<hr><center>cloudflare</center>\n</body>\n</html>\n",
  },
};

/** Every routed operation: the table's, then the public reads it lacks. */
const ROUTES: readonly {
  operationId: RoutedId;
  method: string;
  path: string;
}[] = [
  ...(Object.keys(OPERATIONS) as FixtureOperationId[]).map(operationId => ({
    operationId,
    method: OPERATIONS[operationId].method,
    path: OPERATIONS[operationId].path,
  })),
  ...(Object.keys(CATALOGUE_READS) as CatalogueReadId[])
    .filter(operationId => !Object.hasOwn(OPERATIONS, operationId))
    .map(operationId => ({
      operationId,
      method: "GET",
      path: CATALOGUE_READS[operationId].path,
    })),
];

function newUser(
  me: UserState["me"],
  { tokens, blocked }: { tokens: boolean; blocked: boolean }
): UserState {
  return {
    me: { ...me },
    blocked,
    tokens: tokens ? SAMPLE_TOKENS.map(token => ({ ...token })) : [],
    revoked: new Set(),
  };
}

export function createFixtureState({
  requireMatch = false,
}: { requireMatch?: boolean } = {}): FixtureState {
  return {
    users: new Map(
      (Object.keys(SEED_USERS) as SeedUserId[]).map(id => [
        id,
        newUser(SEED_USERS[id], { tokens: true, blocked: false }),
      ])
    ),
    failures: new Map(),
    outages: new Map(),
    requireMatch,
    sequence: 0,
  };
}

function nextSequence(state: FixtureState): number {
  state.sequence += 1;
  return state.sequence;
}

function parseBody(body: string): unknown {
  if (body === "") return undefined;
  try {
    return JSON.parse(body);
  } catch {
    return INVALID_JSON;
  }
}

function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

function matchPath(
  template: string,
  pathname: string
): Record<string, string> | null {
  const names: string[] = [];
  const pattern = template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    names.push(name);
    return "([^/]+)";
  });
  const match = new RegExp(`^${pattern}$`).exec(pathname);
  if (!match) return null;
  const params: Record<string, string> = {};
  for (const [index, name] of names.entries()) {
    const value = decodeSegment(match[index + 1] ?? "");
    if (value === null || value.includes("/")) return null;
    params[name] = value;
  }
  return params;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function controlError(message: string): FixtureResponse {
  return { status: 400, body: errorBody("invalid_request", message) };
}

function createUser(state: FixtureState, body: unknown): FixtureResponse {
  const options = isRecord(body) ? body : {};
  const role = options.role ?? "contributor";
  if (role !== "contributor" && role !== "moderator") {
    return controlError("role must be contributor or moderator");
  }
  const sequence = nextSequence(state);
  const id = `user-${sequence}`;
  const displayName =
    typeof options.display_name === "string"
      ? options.display_name
      : `${SEED_USERS[role].display_name} ${sequence}`;
  state.users.set(
    id,
    newUser(
      { id: `fixture|${id}`, display_name: displayName, role },
      { tokens: options.tokens !== "none", blocked: options.blocked === true }
    )
  );
  return { status: 201, body: { id } };
}

function isRouted(value: unknown): value is RoutedId {
  return (
    typeof value === "string" &&
    (Object.hasOwn(OPERATIONS, value) || isCatalogueRead(value))
  );
}

function isAuthenticated(operationId: RoutedId): boolean {
  return (
    Object.hasOwn(OPERATIONS, operationId) &&
    OPERATIONS[operationId as FixtureOperationId].authenticated
  );
}

function operationErrors(
  operationId: RoutedId
): Readonly<Record<number, readonly ErrorCode[]>> {
  return Object.hasOwn(OPERATIONS, operationId)
    ? OPERATIONS[operationId as FixtureOperationId].errors
    : CATALOGUE_READS[operationId as CatalogueReadId].errors;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

/** A `match` object's pairs, or the control error to answer. */
function parseMatch(
  state: FixtureState,
  operationId: RoutedId,
  match: unknown
): Match | FixtureResponse {
  const required = state.requireMatch && !isAuthenticated(operationId);
  if (match === undefined) {
    return required
      ? controlError(
          "match is required for a public operation: parallel e2e workers share this server"
        )
      : {};
  }
  const names = specRoute(operationId).parameters.map(({ name }) => name);
  if (
    !isRecord(match) ||
    (required && Object.keys(match).length === 0) ||
    !Object.entries(match).every(
      ([name, value]) => names.includes(name) && typeof value === "string"
    )
  ) {
    return controlError(
      `match must map parameters of ${operationId} (${names.join(", ") || "none"}) to strings`
    );
  }
  return match as Match;
}

function isMatch(value: Match | FixtureResponse): value is Match {
  return !("status" in value && typeof value.status === "number");
}

function stateKey(owner: string, operationId: RoutedId, match: Match): string {
  const pairs = Object.entries(match).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify([owner, operationId, pairs]);
}

function injectFailure(state: FixtureState, body: unknown): FixtureResponse {
  if (!isRecord(body)) return controlError("send a JSON object");
  const { userId, operationId, status, code, times = 1 } = body;
  if (!isRouted(operationId)) {
    return controlError("operationId must be a served operationId");
  }
  const errors = operationErrors(operationId);
  const codes = typeof status === "number" ? errors[status] : null;
  if (!codes) {
    return controlError(
      `status must be one of ${Object.keys(errors).join(", ")}`
    );
  }
  const failureCode = code ?? codes[0];
  if (!codes.some(allowed => allowed === failureCode)) {
    return controlError(`code must be one of ${codes.join(", ")}`);
  }
  if (!isPositiveInteger(times)) {
    return controlError("times must be a positive integer");
  }
  const authenticated = isAuthenticated(operationId);
  if (
    authenticated &&
    !(typeof userId === "string" && state.users.has(userId))
  ) {
    return controlError("userId must be an existing fixture user");
  }
  const match = parseMatch(state, operationId, body.match);
  if (!isMatch(match)) return match;
  addFailure(state, {
    operationId,
    userId: authenticated ? String(userId) : "",
    status: Number(status),
    code: failureCode as ErrorCode,
    times,
    match,
  });
  return { status: 204 };
}

/**
 * Queue a failure without the control endpoint's checks, for unit tests
 * that need a status and code pair the operation doesn't list (the
 * response is still validated against the spec). `userId` is for an
 * authenticated operation only.
 */
export function addFailure(
  state: FixtureState,
  {
    operationId,
    userId = "",
    status,
    code,
    times = 1,
    match = {},
  }: {
    readonly operationId: string;
    readonly userId?: string;
    readonly status: number;
    readonly code: ErrorCode;
    readonly times?: number;
    readonly match?: Match;
  }
): void {
  if (!isRouted(operationId)) {
    throw new Error(`The fixture doesn't route ${operationId}`);
  }
  state.failures.set(stateKey(userId, operationId, match), {
    operationId,
    owner: userId,
    match,
    status,
    code,
    remaining: times,
  });
}

function injectOutage(state: FixtureState, body: unknown): FixtureResponse {
  if (!isRecord(body)) return controlError("send a JSON object");
  const { operationId, mode, times = 1 } = body;
  if (!isRouted(operationId) || isAuthenticated(operationId)) {
    return controlError("operationId must be a public operationId");
  }
  if (mode !== "503" && mode !== "html-502") {
    return controlError('mode must be "503" or "html-502"');
  }
  if (!isPositiveInteger(times)) {
    return controlError("times must be a positive integer");
  }
  const match = parseMatch(state, operationId, body.match);
  if (!isMatch(match)) return match;
  state.outages.set(stateKey("", operationId, match), {
    operationId,
    match,
    mode,
    remaining: times,
  });
  return { status: 204 };
}

/** The request's parameters, which `match` pairs are compared with. */
type Parameters = {
  readonly params: Readonly<Record<string, string>>;
  readonly query: URLSearchParams;
};

function matches(match: Match, { params, query }: Parameters): boolean {
  return Object.entries(match).every(
    ([name, value]) =>
      params[name] === value || query.getAll(name).includes(value)
  );
}

/** Takes one use of the first entry `accepts`; answers it, if any. */
function take<T extends { readonly remaining: number }>(
  entries: Map<string, T>,
  accepts: (entry: T) => boolean
): T | undefined {
  for (const [key, entry] of entries) {
    if (!accepts(entry)) continue;
    if (entry.remaining <= 1) entries.delete(key);
    else entries.set(key, { ...entry, remaining: entry.remaining - 1 });
    return entry;
  }
  return undefined;
}

function takeFailure(
  state: FixtureState,
  owner: string,
  operationId: RoutedId,
  parameters: Parameters
): FixtureResponse | null {
  const failure = take(
    state.failures,
    entry =>
      entry.owner === owner &&
      entry.operationId === operationId &&
      matches(entry.match, parameters)
  );
  if (!failure) return null;
  return {
    status: failure.status,
    body: errorBody(failure.code, "injected failure"),
  };
}

function takeOutage(
  state: FixtureState,
  operationId: RoutedId,
  parameters: Parameters
): FixtureResponse | null {
  const outage = take(
    state.outages,
    entry =>
      entry.operationId === operationId && matches(entry.match, parameters)
  );
  return outage ? OUTAGE_RESPONSES[outage.mode] : null;
}

/** Answers a public operation; null when the table doesn't serve it. */
function handlePublic(
  state: FixtureState,
  operationId: RoutedId,
  operation: PublicOperation | undefined,
  parameters: Parameters,
  search: string
): FixtureResponse | null {
  const outage = takeOutage(state, operationId, parameters);
  if (outage) return outage;
  let query = parameters.query;
  if (isCatalogueRead(operationId)) {
    const parsed = parseCatalogueRequest(
      operationId,
      parameters.params,
      search,
      NO_PUBLIC_TERMS
    );
    if (!parsed.ok) return parsed.response;
    query = parsed.query;
  }
  const failure = takeFailure(state, "", operationId, parameters);
  if (failure) return failure;
  return operation?.handle({ params: parameters.params, query }) ?? null;
}

function handleAuthenticated(
  state: FixtureState,
  operationId: FixtureOperationId,
  operation: AuthenticatedOperation,
  parameters: Parameters,
  request: FixtureRequest
): FixtureResponse {
  const userId = BEARER.exec(request.authorization ?? "")?.[1] ?? "";
  const user = state.users.get(userId);
  if (!user) {
    return {
      status: 401,
      body: errorBody("unauthenticated", "invalid credentials"),
    };
  }
  if (user.blocked) {
    return { status: 403, body: errorBody("user_blocked", "user is blocked") };
  }
  const failure = takeFailure(state, userId, operationId, parameters);
  if (failure) return failure;

  if (operation.hasBody) {
    if (new TextEncoder().encode(request.body).byteLength > MAX_BODY_BYTES) {
      return {
        status: 413,
        body: errorBody("request_too_large", "request body is too large"),
      };
    }
    if (!/^application\/json\s*(;|$)/i.test(request.contentType ?? "")) {
      return {
        status: 415,
        body: errorBody(
          "unsupported_media_type",
          "request body must be sent as application/json"
        ),
      };
    }
  }
  const body = parseBody(request.body);
  if (body === INVALID_JSON) return controlError("invalid request body");
  return operation.handle(user, {
    ...parameters,
    body,
    nextId: () => nextSequence(state),
  });
}

export function handleFixtureRequest(
  state: FixtureState,
  request: FixtureRequest
): FixtureResponse {
  if (request.method === "POST" && request.pathname === "/__fixtures/users") {
    return createUser(state, parseBody(request.body));
  }
  if (request.method === "POST" && request.pathname === "/__fixtures/fail") {
    return injectFailure(state, parseBody(request.body));
  }
  if (request.method === "POST" && request.pathname === "/__fixtures/outage") {
    return injectOutage(state, parseBody(request.body));
  }

  for (const { operationId, method, path } of ROUTES) {
    if (method !== request.method) continue;
    const params = matchPath(path, request.pathname);
    if (!params) continue;
    const parameters = { params, query: new URLSearchParams(request.search) };
    const served = Object.hasOwn(OPERATIONS, operationId)
      ? OPERATIONS[operationId as FixtureOperationId]
      : undefined;
    const response = served?.authenticated
      ? handleAuthenticated(
          state,
          operationId as FixtureOperationId,
          served,
          parameters,
          request
        )
      : handlePublic(state, operationId, served, parameters, request.search);
    if (!response) return NO_SUCH_ROUTE;
    // An outage is what a proxy answers before the backend sees the
    // request, and is deliberately outside the spec: it alone skips the
    // response validation.
    if (response.contentType !== undefined) return response;
    const problems = responseProblems(
      operationId,
      response.status,
      response.body
    );
    if (problems.length > 0) {
      throw new Error(
        `Fixture ${operationId} ${response.status} breaks the spec: ${problems.join("; ")}`
      );
    }
    return response;
  }

  return NO_SUCH_ROUTE;
}
