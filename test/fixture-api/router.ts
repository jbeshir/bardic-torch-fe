import type { components } from "../../app/api/schema.gen";
import { SAMPLE_TOKENS, SEED_USERS, type SeedUserId } from "./data";
import {
  errorBody,
  OPERATIONS,
  type FixtureOperationId,
  type FixtureResponse,
  type UserState,
} from "./operations";
import { responseProblems } from "./spec";

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
 * - `POST /__fixtures/fail {userId?, operationId, status, code?, times?}` →
 *   204: the next `times` (default 1) calls of the operation by that user
 *   (or by anyone, for unauthenticated operations) fail with `status` and
 *   `code`, which must be a pair the spec allows for it.
 *
 * Every operation response is validated against the spec; a fixture that
 * breaks the contract throws instead of answering.
 */

type ErrorCode = components["schemas"]["Error"]["code"];

type Failure = { status: number; code: ErrorCode; remaining: number };

export type FixtureState = {
  users: Map<string, UserState>;
  failures: Map<string, Failure>;
  sequence: number;
};

type FixtureRequest = {
  readonly method: string;
  readonly pathname: string;
  readonly authorization: string | null;
  readonly contentType: string | null;
  readonly body: string;
};

const BEARER = /^Bearer auth0\|fixture:([a-z0-9][a-z0-9-]{0,63})$/;
/** The backend rejects request bodies above 16 KiB. */
const MAX_BODY_BYTES = 16 * 1024;
const INVALID_JSON = Symbol("invalid JSON");

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

export function createFixtureState(): FixtureState {
  return {
    users: new Map(
      (Object.keys(SEED_USERS) as SeedUserId[]).map(id => [
        id,
        newUser(SEED_USERS[id], { tokens: true, blocked: false }),
      ])
    ),
    failures: new Map(),
    sequence: 0,
  };
}

function nextSequence(state: FixtureState): number {
  state.sequence += 1;
  return state.sequence;
}

function failureKey(userId: string, operationId: FixtureOperationId): string {
  return `${userId}:${operationId}`;
}

function parseBody(body: string): unknown {
  if (body === "") return undefined;
  try {
    return JSON.parse(body);
  } catch {
    return INVALID_JSON;
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
  return Object.fromEntries(
    names.map((name, index) => [
      name,
      decodeURIComponent(match[index + 1] ?? ""),
    ])
  );
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

function isFixtureOperation(value: unknown): value is FixtureOperationId {
  return typeof value === "string" && Object.hasOwn(OPERATIONS, value);
}

function injectFailure(state: FixtureState, body: unknown): FixtureResponse {
  if (!isRecord(body)) return controlError("send a JSON object");
  const { userId, operationId, status, code, times = 1 } = body;
  if (!isFixtureOperation(operationId)) {
    return controlError("operationId must be a served operationId");
  }
  const operation = OPERATIONS[operationId];
  const codes = typeof status === "number" ? operation.errors[status] : null;
  if (!codes) {
    return controlError(
      `status must be one of ${Object.keys(operation.errors).join(", ")}`
    );
  }
  const failureCode = code ?? codes[0];
  if (!codes.some(allowed => allowed === failureCode)) {
    return controlError(`code must be one of ${codes.join(", ")}`);
  }
  if (typeof times !== "number" || !Number.isInteger(times) || times < 1) {
    return controlError("times must be a positive integer");
  }
  if (
    operation.authenticated &&
    !(typeof userId === "string" && state.users.has(userId))
  ) {
    return controlError("userId must be an existing fixture user");
  }
  const owner = operation.authenticated ? String(userId) : "";
  state.failures.set(failureKey(owner, operationId), {
    status: Number(status),
    code: failureCode as ErrorCode,
    remaining: times,
  });
  return { status: 204 };
}

function takeFailure(
  state: FixtureState,
  userId: string,
  operationId: FixtureOperationId
): FixtureResponse | null {
  const key = failureKey(userId, operationId);
  const failure = state.failures.get(key);
  if (!failure) return null;
  if (failure.remaining <= 1) state.failures.delete(key);
  else {
    state.failures.set(key, { ...failure, remaining: failure.remaining - 1 });
  }
  return {
    status: failure.status,
    body: errorBody(failure.code, "injected failure"),
  };
}

function handleOperation(
  state: FixtureState,
  operationId: FixtureOperationId,
  params: Record<string, string>,
  request: FixtureRequest
): FixtureResponse {
  const operation = OPERATIONS[operationId];
  if (!operation.authenticated) {
    return takeFailure(state, "", operationId) ?? operation.handle();
  }

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
  const failure = takeFailure(state, userId, operationId);
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
    params,
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

  for (const operationId of Object.keys(OPERATIONS) as FixtureOperationId[]) {
    const operation = OPERATIONS[operationId];
    if (operation.method !== request.method) continue;
    const params = matchPath(operation.path, request.pathname);
    if (!params) continue;

    const response = handleOperation(state, operationId, params, request);
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

  return { status: 404, body: errorBody("not_found", "no such route") };
}
