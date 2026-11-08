import type { components } from "../../app/api/schema.gen";
import { CATALOGUE_OPERATIONS } from "./catalogue-operations";
import type { CatalogueReadId } from "./catalogue/query";
import { errorBody, type FixtureResponse } from "./responses";

/**
 * The fixture API's operations, keyed by the spec's operationIds: the five
 * FE1 calls, the health check the e2e servers wait on, and the 17 public
 * catalogue reads (catalogue-operations.ts). The table is
 * framework-agnostic: the Node server and the msw handlers both route
 * through it (see router.ts). Handlers mirror the backend's rules so the
 * app's error handling is exercised against realistic answers.
 */

type Schemas = components["schemas"];
type ErrorCode = Schemas["Error"]["code"];

export type UserState = {
  me: Schemas["User"];
  blocked: boolean;
  /** Active tokens, oldest first. */
  tokens: Schemas["APIToken"][];
  /** Ids of tokens this user revoked; revoking one again succeeds. */
  revoked: Set<string>;
};

/** What a public operation reads: the path and query parameters. */
export type PublicRequest = {
  readonly params: Readonly<Record<string, string>>;
  /** Decoded; for a catalogue read, only the parameters the spec declares. */
  readonly query: URLSearchParams;
};

type OperationRequest = PublicRequest & {
  readonly body: unknown;
  readonly nextId: () => number;
};

export type FixtureOperation = {
  readonly method: "GET" | "PATCH" | "POST" | "DELETE";
  /** The spec's path template. */
  readonly path: string;
  /** Whether the operation reads a JSON request body. */
  readonly hasBody: boolean;
  /**
   * The error codes the operation may answer with, by the statuses the spec
   * declares; the first is the one an injected failure uses by default.
   */
  readonly errors: Readonly<Record<number, readonly ErrorCode[]>>;
} & (
  | {
      readonly authenticated: false;
      readonly handle: (request: PublicRequest) => FixtureResponse;
    }
  | {
      readonly authenticated: true;
      readonly handle: (
        user: UserState,
        request: OperationRequest
      ) => FixtureResponse;
    }
);

/** The backend's limits, from the spec's descriptions and schemas. */
const DISPLAY_NAME_MAX = 64;
const DISPLAY_NAME_INPUT_MAX = 256;
const TOKEN_NAME_MAX = 128;
const ACTIVE_TOKEN_LIMIT = 10;
const CONTROL_OR_FORMAT = /[\p{Cc}\p{Cf}]/u;

function invalid(message: string): FixtureResponse {
  return { status: 400, body: errorBody("invalid_request", message) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unknownField(
  body: Record<string, unknown>,
  allowed: readonly string[]
): string | undefined {
  return Object.keys(body).find(key => !allowed.includes(key));
}

const characterCount = (value: string) => [...value].length;

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), byte =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function tokenId(sequence: number): string {
  return `00000000-0000-4000-9000-${String(sequence).padStart(12, "0")}`;
}

/** Newest first, as the backend lists them. */
function newestFirst(tokens: readonly Schemas["APIToken"][]) {
  return tokens
    .map((token, index) => ({ token, index }))
    .sort(
      (a, b) =>
        b.token.created_at.localeCompare(a.token.created_at) ||
        b.index - a.index
    )
    .map(({ token }) => token);
}

const USER_ERRORS = {
  401: ["unauthenticated"],
  403: ["user_blocked"],
  500: ["internal"],
} as const;

const TOKEN_ERRORS = {
  401: ["unauthenticated"],
  403: ["user_blocked", "api_token_not_allowed"],
  500: ["internal"],
} as const;

const BODY_ERRORS = {
  413: ["request_too_large"],
  415: ["unsupported_media_type"],
} as const;

/** The operations served; each must be a spec operationId (see router.ts). */
type AccountOperationId =
  | "getHealthz"
  | "getMe"
  | "updateMe"
  | "listAPITokens"
  | "createAPIToken"
  | "revokeAPIToken";

export type FixtureOperationId = AccountOperationId | CatalogueReadId;

const ACCOUNT_OPERATIONS: Readonly<
  Record<AccountOperationId, FixtureOperation>
> = {
  getHealthz: {
    method: "GET",
    path: "/healthz",
    hasBody: false,
    authenticated: false,
    errors: {},
    handle: () => ({ status: 200, body: { status: "ok" } }),
  },
  getMe: {
    method: "GET",
    path: "/v1/me",
    hasBody: false,
    authenticated: true,
    errors: USER_ERRORS,
    handle: user => ({ status: 200, body: user.me }),
  },
  updateMe: {
    method: "PATCH",
    path: "/v1/me",
    hasBody: true,
    authenticated: true,
    errors: { 400: ["invalid_request"], ...USER_ERRORS, ...BODY_ERRORS },
    handle: (user, { body }) => {
      if (!isRecord(body)) return invalid("request body must be an object");
      const extra = unknownField(body, ["display_name"]);
      if (extra) return invalid(`unknown field "${extra}"`);
      const raw = body.display_name;
      if (typeof raw !== "string") return invalid("display_name is required");
      if (characterCount(raw) > DISPLAY_NAME_INPUT_MAX) {
        return invalid("display_name is too long");
      }
      const name = raw.normalize("NFC").trim();
      if (name === "" || characterCount(name) > DISPLAY_NAME_MAX) {
        return invalid(
          `invalid display name: must be 1 to ${DISPLAY_NAME_MAX} characters`
        );
      }
      if (CONTROL_OR_FORMAT.test(name)) {
        return invalid("invalid display name: control or format character");
      }
      user.me = { ...user.me, display_name: name };
      return { status: 200, body: user.me };
    },
  },
  listAPITokens: {
    method: "GET",
    path: "/v1/tokens",
    hasBody: false,
    authenticated: true,
    errors: TOKEN_ERRORS,
    handle: user => ({ status: 200, body: { data: newestFirst(user.tokens) } }),
  },
  createAPIToken: {
    method: "POST",
    path: "/v1/tokens",
    hasBody: true,
    authenticated: true,
    errors: {
      400: ["invalid_request"],
      ...TOKEN_ERRORS,
      409: ["token_limit_reached"],
      ...BODY_ERRORS,
    },
    handle: (user, { body, nextId }) => {
      if (!isRecord(body)) return invalid("request body must be an object");
      const extra = unknownField(body, ["name"]);
      if (extra) return invalid(`unknown field "${extra}"`);
      const raw = body.name ?? null;
      if (raw !== null && typeof raw !== "string") {
        return invalid("name must be a string or null");
      }
      const name = raw?.trim() || null;
      if (name !== null && characterCount(name) > TOKEN_NAME_MAX) {
        return invalid(`name must be at most ${TOKEN_NAME_MAX} characters`);
      }
      if (user.tokens.length >= ACTIVE_TOKEN_LIMIT) {
        return {
          status: 409,
          body: errorBody(
            "token_limit_reached",
            "user has reached the maximum number of active API tokens"
          ),
        };
      }
      const secret = randomHex(32);
      const token: Schemas["APIToken"] = {
        id: tokenId(nextId()),
        prefix: secret.slice(0, 8),
        name,
        created_at: new Date().toISOString(),
        last_used_at: null,
      };
      user.tokens = [...user.tokens, token];
      return { status: 201, body: { ...token, token: `user_api|${secret}` } };
    },
  },
  revokeAPIToken: {
    method: "DELETE",
    path: "/v1/tokens/{token_id}",
    hasBody: false,
    authenticated: true,
    errors: { ...TOKEN_ERRORS, 404: ["not_found"] },
    handle: (user, { params }) => {
      const id = params.token_id ?? "";
      if (user.revoked.has(id)) return { status: 204 };
      if (!user.tokens.some(token => token.id === id)) {
        return {
          status: 404,
          body: errorBody("not_found", "API token not found"),
        };
      }
      user.tokens = user.tokens.filter(token => token.id !== id);
      user.revoked = new Set([...user.revoked, id]);
      return { status: 204 };
    },
  },
};

export const OPERATIONS: Readonly<
  Record<FixtureOperationId, FixtureOperation>
> = { ...ACCOUNT_OPERATIONS, ...CATALOGUE_OPERATIONS };
