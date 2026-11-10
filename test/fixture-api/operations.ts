import type { components } from "../../app/api/schema.gen";
import { CATALOGUE_OPERATIONS } from "./catalogue-operations";
import type { CatalogueReadId } from "./catalogue/query";
import { errorBody, type FixtureResponse } from "./responses";

/**
 * The fixture API's operations, keyed by the spec's operationIds: the FE1
 * calls, the health check the e2e servers wait on, and the 17 public
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
};

/** What a public operation reads: the path and query parameters. */
export type PublicRequest = {
  readonly params: Readonly<Record<string, string>>;
  /** Decoded; for a catalogue read, only the parameters the spec declares. */
  readonly query: URLSearchParams;
};

type OperationRequest = PublicRequest & {
  readonly body: unknown;
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

const USER_ERRORS = {
  401: ["unauthenticated"],
  403: ["user_blocked"],
  500: ["internal"],
} as const;

const BODY_ERRORS = {
  413: ["request_too_large"],
  415: ["unsupported_media_type"],
} as const;

/** The operations served; each must be a spec operationId (see router.ts). */
type AccountOperationId = "getHealthz" | "getMe" | "updateMe";

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
};

export const OPERATIONS: Readonly<
  Record<FixtureOperationId, FixtureOperation>
> = { ...ACCOUNT_OPERATIONS, ...CATALOGUE_OPERATIONS };
