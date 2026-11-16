import type { RouterContextProvider } from "react-router";
import type { components, operations } from "~/api/schema.gen";
import { type UpstreamErrorCode, type User } from "~/schemas/api";
import {
  TRY_AGAIN_MESSAGE,
  type ProxyError,
  type ProxyErrorCode,
} from "~/schemas/proxy";
import {
  createAuthenticatedFetch,
  getOrCreateSessionStorage,
} from "./auth.server";
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
 * Server-side client for the Bardic Torch API. Every call is authenticated
 * with the session's bearer token, and
 * resolves to an `ApiResult`; nothing throws. Only the headers built here
 * reach the API, so a client's Cookie or Authorization is never forwarded.
 *
 * Upstream error messages are not meant for end users, so every error the
 * app sees carries copy written here, chosen by the upstream `code` for
 * the few codes a page treats differently; anything else is `try_again`.
 */

/** The codes this module answers with: not the CSRF check's or the browser's. */
type ErrorCode = Exclude<ProxyErrorCode, "forbidden" | "offline">;

type Schemas = components["schemas"];

/**
 * An error the app reports, with its own copy (see `upstreamError`). A 422
 * carries the API's `problems`, and a 409 `possible_duplicate` its matches.
 */
type ApiError = ProxyError & {
  readonly code: ErrorCode;
  readonly problems?: readonly Schemas["Problem"][];
  readonly duplicates?: readonly Schemas["DuplicateMatch"][];
};

type ApiResult<T> = (
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: ApiError }
) & {
  readonly status: number;
  /** Headers the caller's response must carry, such as a refreshed session. */
  readonly headers: Headers;
};

/**
 * Where each authenticated operation lives; the compiler checks it against
 * the spec.
 */
const ENDPOINTS = {
  getMe: { method: "GET", path: "/v1/me" },
  getEditablePiece: { method: "GET", path: "/v1/pieces/{slug}/editable" },
  getEditablePerson: { method: "GET", path: "/v1/persons/{slug}/editable" },
  getEditableTerm: { method: "GET", path: "/v1/terms/{slug}/editable" },
  getEditableEvent: { method: "GET", path: "/v1/events/{slug}/editable" },
  getEditableCollection: {
    method: "GET",
    path: "/v1/collections/{collection_id}/editable",
  },
  submitRevision: { method: "POST", path: "/v1/revisions" },
  listMyRevisions: { method: "GET", path: "/v1/me/revisions" },
  withdrawRevision: {
    method: "POST",
    path: "/v1/revisions/{revision_id}/withdraw",
  },
  createContactRequest: { method: "POST", path: "/v1/contact" },
} as const satisfies {
  readonly [Id in keyof operations]?: EndpointOf<operations[Id]>;
};

type OperationId = keyof typeof ENDPOINTS;

type ApiRequest = {
  readonly operationId: OperationId;
  readonly params?: Readonly<Record<string, string>>;
  readonly query?: URLSearchParams;
  readonly body?: unknown;
};

const TRY_AGAIN: ApiError = {
  code: "try_again",
  message: TRY_AGAIN_MESSAGE,
};

const SIGNED_OUT: ApiError = {
  code: "unauthenticated",
  message:
    "You’ve been signed out. Log in again and we’ll bring you back here.",
};

/**
 * What the user is told for an upstream error code a page treats
 * differently; undefined for any other, which is a try again.
 */
function upstreamError(
  operationId: OperationId,
  code: UpstreamErrorCode
): ApiError | undefined {
  switch (code) {
    case "user_blocked":
      return {
        code,
        message:
          "Your account is blocked, so you can’t make changes. Contact the Bardic Torch team if you think this is a mistake.",
      };
    case "not_found":
      return {
        code,
        message:
          "We couldn’t find what you asked for. Reload the page and try again.",
      };
    case "possible_duplicate":
      return {
        code,
        message:
          "This may already be in the catalogue. Check the pages below, and submit again if yours is a different one.",
      };
    case "stale_revision":
      return {
        code,
        message:
          "This page has changed since you started editing. Check the current version, then save again to replace those changes.",
      };
    case "revision_not_pending":
      return {
        code,
        message:
          "That edit is no longer waiting for review, so it can’t be withdrawn. Reload the page to see where it stands.",
      };
    case "turnstile_failed":
      return {
        code,
        message:
          "We couldn’t check that you’re not a robot. Reload the page and try again.",
      };
    case "pending_limit_reached":
      return {
        code,
        message:
          "You already have 30 edits waiting for review. Withdraw one, or wait for a moderator to review them, then try again.",
      };
    case "request_too_large":
      return {
        code: "invalid_request",
        message: "The form is too large to send.",
      };
    case "validation_failed":
      return {
        code,
        message: "Check the highlighted fields.",
      };
    case "invalid_request":
      return operationId === "createContactRequest"
        ? { code, message: "Check your message and try again." }
        : undefined;
    default:
      return undefined;
  }
}

function failure(
  status: number,
  error: ApiError,
  headers = new Headers()
): ApiResult<never> {
  return { ok: false, status, error, headers };
}

async function callApi<T>(
  request: Request,
  context: Readonly<RouterContextProvider>,
  apiRequest: ApiRequest
): Promise<ApiResult<T>> {
  const env = context.get(appEnvContext);
  const auth = await createAuthenticatedFetch(request, context);
  const headers = new Headers(auth.headers);

  // The contact form needs no account (the API ignores credentials on it).
  const needsAccount = apiRequest.operationId !== "createContactRequest";
  if (needsAccount && !auth.isAuthenticated) {
    return failure(401, SIGNED_OUT, headers);
  }

  // The timeout covers the body too: a body that stalls or breaks off
  // ends like a request that never got an answer.
  const signal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
  let response: Response;
  let text: string;
  try {
    response = await auth.authFetch(
      upstreamUrl(
        env.BARDIC_TORCH_API_BASE_URL,
        ENDPOINTS[apiRequest.operationId].path,
        apiRequest.params
      ) + (apiRequest.query ? `?${apiRequest.query}` : ""),
      {
        method: ENDPOINTS[apiRequest.operationId].method,
        headers:
          apiRequest.body === undefined
            ? { Accept: "application/json" }
            : {
                Accept: "application/json",
                "Content-Type": "application/json",
              },
        ...(apiRequest.body === undefined
          ? {}
          : { body: JSON.stringify(apiRequest.body) }),
        redirect: "manual",
        signal,
      }
    );
    text = await Promise.race([response.text(), aborted(signal)]);
  } catch (error) {
    console.error(
      `${apiRequest.operationId} ${isTimeout(error) ? "timed out" : "failed"}:`,
      error
    );
    return failure(503, TRY_AGAIN, headers);
  }

  if (response.status === 401) {
    const sessionStorage = getOrCreateSessionStorage(env);
    const session = await sessionStorage.getSession(
      request.headers.get("Cookie")
    );
    headers.set("Set-Cookie", await sessionStorage.destroySession(session));
    return failure(401, SIGNED_OUT, headers);
  }

  const payload = parseJson(text);
  const body =
    typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : undefined;
  // No content, and the contact form's 202: neither has a body.
  if (response.status === 204 || response.status === 202) {
    return { ok: true, status: response.status, data: undefined as T, headers };
  }
  if (response.ok) {
    if (body) {
      return { ok: true, status: response.status, data: body as T, headers };
    }
  } else if (response.status >= 400) {
    const code =
      typeof body?.code === "string"
        ? (body.code as UpstreamErrorCode)
        : undefined;
    const error =
      code === undefined
        ? undefined
        : upstreamError(apiRequest.operationId, code);
    if (error) {
      const { problems, possible_duplicates } = body as {
        readonly problems?: Schemas["Problem"][];
        readonly possible_duplicates?: Schemas["DuplicateMatch"][];
      };
      return failure(
        response.status,
        code === "validation_failed" && problems
          ? { ...error, problems }
          : code === "possible_duplicate" && possible_duplicates
            ? { ...error, duplicates: possible_duplicates }
            : error,
        headers
      );
    }
  }

  console.error(
    `${apiRequest.operationId} returned an unexpected ${response.status} response`
  );
  return failure(503, TRY_AGAIN, headers);
}

type RequestBody<Id extends OperationId> = operations[Id] extends {
  requestBody: { content: { "application/json": infer Body } };
}
  ? Body
  : never;

export function getMe(
  request: Request,
  context: Readonly<RouterContextProvider>
) {
  return callApi<User>(request, context, {
    operationId: "getMe",
  });
}

const EDITABLE_OPERATIONS = {
  piece: "getEditablePiece",
  person: "getEditablePerson",
  term: "getEditableTerm",
  event: "getEditableEvent",
  collection: "getEditableCollection",
} as const satisfies Record<Schemas["EntityType"], OperationId>;

/**
 * An entity's editable document (`GET /v1/{type}/{key}/editable`): `key`
 * is the slug, or a collection's id, already checked by the route.
 */
export function getEditable(
  request: Request,
  context: Readonly<RouterContextProvider>,
  type: Schemas["EntityType"],
  key: string
) {
  return callApi<Schemas["Editable"]>(request, context, {
    operationId: EDITABLE_OPERATIONS[type],
    params: type === "collection" ? { collection_id: key } : { slug: key },
  });
}

export function submitRevision(
  request: Request,
  context: Readonly<RouterContextProvider>,
  body: RequestBody<"submitRevision">
) {
  return callApi<Schemas["RevisionView"]>(request, context, {
    operationId: "submitRevision",
    body,
  });
}

/** The caller's own revisions (`GET /v1/me/revisions`), newest first. */
export function listMyRevisions(
  request: Request,
  context: Readonly<RouterContextProvider>,
  query: URLSearchParams
) {
  return callApi<Schemas["RevisionList"]>(request, context, {
    operationId: "listMyRevisions",
    query,
  });
}

/** Withdraws one of the caller's pending revisions; `id` is already checked. */
export function withdrawRevision(
  request: Request,
  context: Readonly<RouterContextProvider>,
  id: string
) {
  return callApi<undefined>(request, context, {
    operationId: "withdrawRevision",
    params: { revision_id: id },
  });
}

/** Sends the contact form to the moderators; it needs no account. */
export function createContactRequest(
  request: Request,
  context: Readonly<RouterContextProvider>,
  body: RequestBody<"createContactRequest">
) {
  return callApi<undefined>(request, context, {
    operationId: "createContactRequest",
    body,
  });
}
