import type { RouterContextProvider } from "react-router";
import { z } from "zod";
import type { components, operations } from "~/api/schema.gen";
import { type UpstreamErrorCode, type User } from "~/schemas/api";
import { DISPLAY_NAME_RULE } from "~/schemas/rules";
import {
  TRY_AGAIN_MESSAGE,
  type ProxyBody,
  type ProxyError,
  type ProxyErrorCode,
} from "~/schemas/proxy";
import {
  createAuthenticatedFetch,
  getOrCreateSessionStorage,
  getServerAuthContext,
} from "./auth.server";
import { appEnvContext } from "./context.server";
import { jsonResponse } from "./json.server";
import {
  aborted,
  type EndpointOf,
  isTimeout,
  parseJson,
  type Method,
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
  updateMe: { method: "PATCH", path: "/v1/me" },
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
  listModerationQueue: { method: "GET", path: "/v1/moderation/queue" },
  getModerationRevision: {
    method: "GET",
    path: "/v1/moderation/revisions/{revision_id}",
  },
  approveRevision: {
    method: "POST",
    path: "/v1/revisions/{revision_id}/approve",
  },
  rejectRevision: {
    method: "POST",
    path: "/v1/revisions/{revision_id}/reject",
  },
  listContactRequests: {
    method: "GET",
    path: "/v1/moderation/contact-requests",
  },
  closeContactRequest: {
    method: "POST",
    path: "/v1/moderation/contact-requests/{request_id}",
  },
  getModerationLink: { method: "GET", path: "/v1/moderation/links" },
  setLinkHidden: { method: "PUT", path: "/v1/links/{link_id}/hidden" },
  setUserBlocked: { method: "PUT", path: "/v1/users/{user_id}/blocked" },
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

/** For a moderator's page or action, to anyone else. */
export const MODERATORS_ONLY: ApiError = {
  code: "moderator_required",
  message:
    "This page is for moderators. If you are one, log in with your moderator account.",
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
          operationId === "getModerationLink"
            ? "No link on the site has that address."
            : "We couldn’t find what you asked for. Reload the page and try again.",
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
          operationId === "approveRevision"
            ? "This page has changed since the edit was made. Approve it anyway to replace those changes, or reject it and ask for it to be redone on the current version."
            : "This page has changed since you started editing. Check the current version, then save again to replace those changes.",
      };
    case "revision_not_pending":
      return {
        code,
        message:
          operationId === "withdrawRevision"
            ? "That edit is no longer waiting for review, so it can’t be withdrawn. Reload the page to see where it stands."
            : "That edit is no longer waiting for review. Reload the page to see where it stands.",
      };
    case "moderator_required":
      return MODERATORS_ONLY;
    case "conflict":
      return {
        code,
        message:
          operationId === "setUserBlocked"
            ? "Moderators can’t be blocked or unblocked."
            : "That request is already closed. Reload the page to see it.",
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
        message:
          operationId === "approveRevision"
            ? "This edit no longer passes the catalogue’s checks, so it can’t be approved. Reject it with a note on what to fix."
            : "Check the highlighted fields.",
      };
    case "invalid_request":
      return operationId === "updateMe"
        ? {
            code,
            message: "Check the display name.",
            fields: [{ field: "display_name", message: DISPLAY_NAME_RULE }],
          }
        : operationId === "createContactRequest"
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

/**
 * Read and validate a proxy route's form body; an unreadable body or invalid
 * fields are a 400.
 */
async function readFormBody<S extends z.ZodType>(
  request: Request,
  schema: S
): Promise<
  { readonly ok: true; readonly data: z.output<S> } | ApiResult<never>
> {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return failure(400, {
      code: "invalid_request",
      message: "The form didn’t arrive in full. Try again.",
    });
  }

  const parsed = schema.safeParse(Object.fromEntries(form));
  if (parsed.success) return { ok: true, data: parsed.data };
  return failure(400, {
    code: "invalid_request",
    message: "Check the highlighted fields.",
    fields: parsed.error.issues.map(issue => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  });
}

/**
 * A proxy route's answer to a form submission: signed out gets a 401
 * before the body is read; then the form is read and validated
 * (`readFormBody`) and `send` makes the API call with it. A refreshed
 * session cookie goes out on every answer, including the form's errors.
 */
export async function proxyForm<S extends z.ZodType>(
  request: Request,
  context: Readonly<RouterContextProvider>,
  schema: S,
  send: (data: z.output<S>) => Promise<ApiResult<unknown>>
): Promise<Response> {
  const auth = await getServerAuthContext(request, context);
  if (!auth.authContext.isAuthenticated) {
    return proxyResponse(failure(401, SIGNED_OUT, new Headers(auth.headers)));
  }
  const body = await readFormBody(request, schema);
  if (!body.ok) {
    return proxyResponse({ ...body, headers: new Headers(auth.headers) });
  }
  return proxyResponse(await send(body.data));
}

/**
 * The JSON response of a proxy route: the result without its headers, never
 * cached. A 204 becomes a 200 so fetchers can read the body.
 */
function proxyResponse(result: ApiResult<unknown>): Response {
  const headers = new Headers(result.headers);
  headers.set("Cache-Control", "no-store");
  return jsonResponse<ProxyBody<unknown>>(
    result.ok
      ? { ok: true, data: result.data }
      : { ok: false, error: result.error },
    { status: result.status === 204 ? 200 : result.status, headers }
  );
}

/** 405 for methods a proxy route does not implement. */
export function methodNotAllowed(allowed: Method): Response {
  return proxyResponse(
    failure(
      405,
      {
        code: "method_not_allowed",
        message: `Only ${allowed} is supported here.`,
      },
      new Headers({ Allow: allowed })
    )
  );
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

export function updateMe(
  request: Request,
  context: Readonly<RouterContextProvider>,
  body: RequestBody<"updateMe">
) {
  return callApi<User>(request, context, {
    operationId: "updateMe",
    body,
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

/** The pending revisions, oldest first (`GET /v1/moderation/queue`). */
export function listModerationQueue(
  request: Request,
  context: Readonly<RouterContextProvider>,
  query: URLSearchParams
) {
  return callApi<Schemas["RevisionList"]>(request, context, {
    operationId: "listModerationQueue",
    query,
  });
}

/** A revision as a moderator reviews it; `id` is already checked. */
export function getModerationRevision(
  request: Request,
  context: Readonly<RouterContextProvider>,
  id: string
) {
  return callApi<Schemas["ModerationRevisionView"]>(request, context, {
    operationId: "getModerationRevision",
    params: { revision_id: id },
  });
}

export function approveRevision(
  request: Request,
  context: Readonly<RouterContextProvider>,
  id: string,
  body: RequestBody<"approveRevision">
) {
  return callApi<undefined>(request, context, {
    operationId: "approveRevision",
    params: { revision_id: id },
    body,
  });
}

export function rejectRevision(
  request: Request,
  context: Readonly<RouterContextProvider>,
  id: string,
  body: RequestBody<"rejectRevision">
) {
  return callApi<undefined>(request, context, {
    operationId: "rejectRevision",
    params: { revision_id: id },
    body,
  });
}

/** A page of contact requests with one status, oldest first. */
export function listContactRequests(
  request: Request,
  context: Readonly<RouterContextProvider>,
  query: URLSearchParams
) {
  return callApi<Schemas["ContactRequestList"]>(request, context, {
    operationId: "listContactRequests",
    query,
  });
}

/** Resolves or dismisses an open contact request; `id` is already checked. */
export function closeContactRequest(
  request: Request,
  context: Readonly<RouterContextProvider>,
  id: string,
  body: RequestBody<"closeContactRequest">
) {
  return callApi<undefined>(request, context, {
    operationId: "closeContactRequest",
    params: { request_id: id },
    body,
  });
}

/** The link with this URL, hidden or not, and where it is attached. */
export function getModerationLink(
  request: Request,
  context: Readonly<RouterContextProvider>,
  url: string
) {
  return callApi<Schemas["ModerationLink"]>(request, context, {
    operationId: "getModerationLink",
    query: new URLSearchParams({ url }),
  });
}

/** Hides a link everywhere, or restores it; `id` is already checked. */
export function setLinkHidden(
  request: Request,
  context: Readonly<RouterContextProvider>,
  id: string,
  body: RequestBody<"setLinkHidden">
) {
  return callApi<undefined>(request, context, {
    operationId: "setLinkHidden",
    params: { link_id: id },
    body,
  });
}

/** Blocks or unblocks a contributor by their user ID. */
export function setUserBlocked(
  request: Request,
  context: Readonly<RouterContextProvider>,
  userId: string,
  body: RequestBody<"setUserBlocked">
) {
  return callApi<User>(request, context, {
    operationId: "setUserBlocked",
    params: { user_id: userId },
    body,
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
