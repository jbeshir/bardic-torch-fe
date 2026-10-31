import type { FixtureOperationId } from "../fixture-api/operations";

/**
 * Requests that exercise every fixture operation, with the status each must
 * produce. The fixture, server and msw tests run all of them through their
 * own transport and validate every response against the spec.
 */

type Caller =
  /** A fresh fixture user with the sample tokens. */
  | "user"
  /** A fresh fixture user who is blocked. */
  | "blocked"
  /** No Authorization header. */
  | "anonymous"
  /** The user's bearer without the `auth0|` prefix the app adds. */
  | "unprefixed";

type Scenario = {
  readonly operationId: FixtureOperationId;
  readonly name: string;
  readonly method: string;
  readonly path: string;
  readonly caller: Caller;
  /** A JSON body, or a raw string sent as-is. */
  readonly body?: unknown;
  readonly contentType?: string;
  /** Inject this failure for the operation first. */
  readonly fail?: { readonly status: number; readonly code?: string };
  /** Create tokens until the user is at the limit first. */
  readonly atTokenLimit?: boolean;
  readonly status: number;
};

type SendRequest = {
  readonly method: string;
  readonly path: string;
  readonly authorization?: string;
  readonly contentType?: string;
  readonly body?: string;
};

type SendResult = { readonly status: number; readonly body: unknown };

/** One transport: the router directly, the HTTP server or msw. */
export type Send = (request: SendRequest) => Promise<SendResult>;

const SAMPLE_TOKEN_ID = "00000000-0000-4000-8000-000000000001";
const LONG = (length: number) => "x".repeat(length);

export function bearer(userId: string): string {
  return `Bearer auth0|fixture:${userId}`;
}

export function json(body: unknown): Pick<SendRequest, "contentType" | "body"> {
  return { contentType: "application/json", body: JSON.stringify(body) };
}

export async function createUser(
  send: Send,
  options: Record<string, unknown> = {}
): Promise<string> {
  const { body } = await send({
    method: "POST",
    path: "/__fixtures/users",
    ...json(options),
  });
  return (body as { id: string }).id;
}

/** Run a scenario as a fresh user; resolves to the operation's response. */
export async function runScenario(
  scenario: Scenario,
  send: Send
): Promise<SendResult> {
  const userId = await createUser(send, {
    blocked: scenario.caller === "blocked",
  });
  if (scenario.atTokenLimit) {
    let status = 201;
    while (status === 201) {
      ({ status } = await send({
        method: "POST",
        path: "/v1/tokens",
        authorization: bearer(userId),
        ...json({}),
      }));
    }
  }
  if (scenario.fail) {
    const injected = await send({
      method: "POST",
      path: "/__fixtures/fail",
      ...json({ userId, operationId: scenario.operationId, ...scenario.fail }),
    });
    if (injected.status !== 204) {
      throw new Error(`Could not inject ${JSON.stringify(scenario.fail)}`);
    }
  }
  const authorization = {
    user: bearer(userId),
    blocked: bearer(userId),
    anonymous: undefined,
    unprefixed: `Bearer fixture:${userId}`,
  }[scenario.caller];
  const body =
    scenario.body === undefined
      ? {}
      : typeof scenario.body === "string"
        ? { body: scenario.body }
        : json(scenario.body);
  return send({
    method: scenario.method,
    path: scenario.path,
    ...(authorization ? { authorization } : {}),
    ...body,
    ...(scenario.contentType ? { contentType: scenario.contentType } : {}),
  });
}

const getMe = { operationId: "getMe", method: "GET", path: "/v1/me" } as const;
const updateMe = {
  operationId: "updateMe",
  method: "PATCH",
  path: "/v1/me",
} as const;
const listTokens = {
  operationId: "listAPITokens",
  method: "GET",
  path: "/v1/tokens",
} as const;
const createToken = {
  operationId: "createAPIToken",
  method: "POST",
  path: "/v1/tokens",
} as const;
const revokeToken = {
  operationId: "revokeAPIToken",
  method: "DELETE",
  path: `/v1/tokens/${SAMPLE_TOKEN_ID}`,
} as const;

export const SCENARIOS: readonly Scenario[] = [
  {
    operationId: "getHealthz",
    name: "up",
    method: "GET",
    path: "/healthz",
    caller: "anonymous",
    status: 200,
  },

  { ...getMe, name: "signed in", caller: "user", status: 200 },
  { ...getMe, name: "signed out", caller: "anonymous", status: 401 },
  {
    ...getMe,
    name: "bearer without auth0|",
    caller: "unprefixed",
    status: 401,
  },
  { ...getMe, name: "blocked", caller: "blocked", status: 403 },
  {
    ...getMe,
    name: "injected 500",
    caller: "user",
    fail: { status: 500 },
    status: 500,
  },

  {
    ...updateMe,
    name: "valid name",
    caller: "user",
    body: { display_name: " Morwen the Younger " },
    status: 200,
  },
  {
    ...updateMe,
    name: "blank name",
    caller: "user",
    body: { display_name: "  " },
    status: 400,
  },
  {
    ...updateMe,
    name: "65 characters",
    caller: "user",
    body: { display_name: LONG(65) },
    status: 400,
  },
  {
    ...updateMe,
    name: "a format character",
    caller: "user",
    body: { display_name: "Morwen\u202e" },
    status: 400,
  },
  {
    ...updateMe,
    name: "unknown field",
    caller: "user",
    body: { display_name: "Morwen", role: "moderator" },
    status: 400,
  },
  {
    ...updateMe,
    name: "invalid JSON",
    caller: "user",
    body: "{",
    contentType: "application/json",
    status: 400,
  },
  {
    ...updateMe,
    name: "signed out",
    caller: "anonymous",
    body: { display_name: "Morwen" },
    status: 401,
  },
  {
    ...updateMe,
    name: "blocked",
    caller: "blocked",
    body: { display_name: "Morwen" },
    status: 403,
  },
  {
    ...updateMe,
    name: "body over 16 KiB",
    caller: "user",
    body: { display_name: LONG(17_000) },
    status: 413,
  },
  {
    ...updateMe,
    name: "form-encoded body",
    caller: "user",
    body: "display_name=Morwen",
    contentType: "application/x-www-form-urlencoded",
    status: 415,
  },
  {
    ...updateMe,
    name: "injected 500",
    caller: "user",
    body: { display_name: "Morwen" },
    fail: { status: 500 },
    status: 500,
  },

  { ...listTokens, name: "signed in", caller: "user", status: 200 },
  { ...listTokens, name: "signed out", caller: "anonymous", status: 401 },
  {
    ...listTokens,
    name: "injected 403 api_token_not_allowed",
    caller: "user",
    fail: { status: 403, code: "api_token_not_allowed" },
    status: 403,
  },

  {
    ...createToken,
    name: "named",
    caller: "user",
    body: { name: " CI runner " },
    status: 201,
  },
  { ...createToken, name: "unnamed", caller: "user", body: {}, status: 201 },
  {
    ...createToken,
    name: "null name",
    caller: "user",
    body: { name: null },
    status: 201,
  },
  {
    ...createToken,
    name: "129-character name",
    caller: "user",
    body: { name: LONG(129) },
    status: 400,
  },
  {
    ...createToken,
    name: "signed out",
    caller: "anonymous",
    body: {},
    status: 401,
  },
  {
    ...createToken,
    name: "at the token limit",
    caller: "user",
    body: {},
    atTokenLimit: true,
    status: 409,
  },
  {
    ...createToken,
    name: "injected 403 api_token_not_allowed",
    caller: "user",
    body: {},
    fail: { status: 403, code: "api_token_not_allowed" },
    status: 403,
  },

  { ...revokeToken, name: "own token", caller: "user", status: 204 },
  {
    ...revokeToken,
    name: "unknown token",
    caller: "user",
    path: "/v1/tokens/no-such-token",
    status: 404,
  },
  { ...revokeToken, name: "signed out", caller: "anonymous", status: 401 },
  {
    ...revokeToken,
    name: "injected 500",
    caller: "user",
    fail: { status: 500 },
    status: 500,
  },
];
