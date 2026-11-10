import type { FixtureOperationId } from "../fixture-api/operations";

/**
 * Requests that exercise every fixture operation, with the status each must
 * produce. The fixture, server and msw tests run all of them through their
 * own transport and validate every response against the spec.
 */

type Caller =
  /** A fresh fixture user. */
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
  readonly fail?: {
    readonly status: number;
    readonly code?: string;
    /** Required for a public operation: path or query parameters to fail on. */
    readonly match?: Readonly<Record<string, string>>;
  };
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
/**
 * One public catalogue read: a request that succeeds, one that is a real
 * invalid parameter (400), one for an unknown entity (404, only where the
 * spec declares it) and the `match` an injected 500 fires on.
 */
type PublicRead = {
  readonly operationId: FixtureOperationId;
  readonly ok: string;
  readonly invalid: string;
  readonly missing?: string;
  readonly match: Readonly<Record<string, string>>;
  /** A request whose path parameter decodes to contain `/`; 404 "no such route". */
  readonly encodedSlash?: string;
};

const PUBLIC_READS: readonly PublicRead[] = [
  {
    operationId: "listPieces",
    ok: "/v1/pieces?kind=song&limit=5",
    invalid: "/v1/pieces?limit=0",
    match: { kind: "song" },
  },
  {
    operationId: "getPiece",
    ok: "/v1/pieces/the-copper-kettle",
    invalid: "/v1/pieces/The-Lay",
    missing: "/v1/pieces/no-such-piece",
    match: { slug: "the-copper-kettle" },
    encodedSlash: "/v1/pieces/a%2Fb",
  },
  {
    operationId: "listPersons",
    ok: "/v1/persons?limit=5",
    invalid: "/v1/persons?limit=0",
    match: { limit: "5" },
  },
  {
    operationId: "getPerson",
    ok: "/v1/persons/aldith-of-ashdown",
    invalid: "/v1/persons/wren--vale",
    missing: "/v1/persons/no-such-person",
    match: { slug: "aldith-of-ashdown" },
    encodedSlash: "/v1/persons/a%2Fb",
  },
  {
    operationId: "listTerms",
    ok: "/v1/terms?facet=mood",
    invalid: "/v1/terms?facet=nope",
    match: { facet: "mood" },
  },
  {
    operationId: "getTerm",
    ok: "/v1/terms/eerie",
    invalid: "/v1/terms/caf%C3%A9",
    missing: "/v1/terms/no-such-term",
    match: { slug: "eerie" },
    encodedSlash: "/v1/terms/a%2Fb",
  },
  {
    operationId: "listCollections",
    ok: "/v1/collections?limit=5",
    invalid: "/v1/collections?limit=0",
    match: { limit: "5" },
  },
  {
    operationId: "getCollection",
    ok: "/v1/collections/13",
    invalid: "/v1/collections/0",
    missing: "/v1/collections/999999",
    match: { collection_id: "13" },
    encodedSlash: "/v1/collections/1%2F2",
  },
  {
    operationId: "listEvents",
    ok: "/v1/events?limit=5",
    invalid: "/v1/events?limit=0",
    match: { limit: "5" },
  },
  {
    operationId: "getEvent",
    ok: "/v1/events/ashdown-twelfth-night",
    invalid: "/v1/events/-revel",
    missing: "/v1/events/no-such-event",
    match: { slug: "ashdown-twelfth-night" },
    encodedSlash: "/v1/events/a%2Fb",
  },
  {
    operationId: "listPieceRevisions",
    ok: "/v1/pieces/the-copper-kettle/history",
    invalid: "/v1/pieces/the_lay/history",
    missing: "/v1/pieces/no-such-piece/history",
    match: { slug: "the-copper-kettle" },
    encodedSlash: "/v1/pieces/a%2Fb/history",
  },
  {
    operationId: "listPersonRevisions",
    ok: "/v1/persons/aldith-of-ashdown/history",
    invalid: "/v1/persons/wren--vale/history",
    missing: "/v1/persons/no-such-person/history",
    match: { slug: "aldith-of-ashdown" },
    encodedSlash: "/v1/persons/a%2Fb/history",
  },
  {
    operationId: "listTermRevisions",
    ok: "/v1/terms/eerie/history",
    invalid: "/v1/terms/Eerie/history",
    missing: "/v1/terms/no-such-term/history",
    match: { slug: "eerie" },
    encodedSlash: "/v1/terms/a%2Fb/history",
  },
  {
    operationId: "listCollectionRevisions",
    ok: "/v1/collections/13/history",
    invalid: "/v1/collections/-1/history",
    missing: "/v1/collections/999999/history",
    match: { collection_id: "13" },
    encodedSlash: "/v1/collections/1%2F2/history",
  },
  {
    operationId: "listEventRevisions",
    ok: "/v1/events/ashdown-twelfth-night/history",
    invalid: "/v1/events/-revel/history",
    missing: "/v1/events/no-such-event/history",
    match: { slug: "ashdown-twelfth-night" },
    encodedSlash: "/v1/events/a%2Fb/history",
  },
  {
    operationId: "getRevision",
    ok: "/v1/revisions/1001",
    invalid: "/v1/revisions/0",
    missing: "/v1/revisions/999999",
    match: { revision_id: "1001" },
    encodedSlash: "/v1/revisions/1%2F2",
  },
  {
    operationId: "listNeedsWork",
    ok: "/v1/needs-work?limit=5",
    invalid: "/v1/needs-work?reason=nope",
    match: { limit: "5" },
  },
];

/** Per public read: a success, each declared error and, for path parameters, `%2F`. */
const PUBLIC_SCENARIOS: readonly Scenario[] = PUBLIC_READS.flatMap(read => {
  const base = {
    operationId: read.operationId,
    method: "GET",
    caller: "anonymous",
  } as const;
  return [
    { ...base, name: "found", path: read.ok, status: 200 },
    { ...base, name: "invalid parameter", path: read.invalid, status: 400 },
    ...(read.missing === undefined
      ? []
      : [{ ...base, name: "unknown", path: read.missing, status: 404 }]),
    ...(read.encodedSlash === undefined
      ? []
      : [
          {
            ...base,
            name: "%2F in a path parameter",
            path: read.encodedSlash,
            status: 404,
          },
        ]),
    {
      ...base,
      name: "injected 500",
      path: read.ok,
      fail: { status: 500, match: read.match },
      status: 500,
    },
  ];
});

export const SCENARIOS: readonly Scenario[] = [
  ...PUBLIC_SCENARIOS,

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
];
