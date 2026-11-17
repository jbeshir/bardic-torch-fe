import type { RouterContextProvider } from "react-router";
import type { operations } from "~/api/schema.gen";
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

/**
 * An error the app reports, with its own copy (see `upstreamError`).
 */
type ApiError = ProxyError & {
  readonly code: ErrorCode;
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
function upstreamError(code: UpstreamErrorCode): ApiError | undefined {
  switch (code) {
    case "user_blocked":
      return {
        code,
        message:
          "Your account is blocked, so you can’t make changes. Contact the Bardic Torch team if you think this is a mistake.",
      };
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

  if (!auth.isAuthenticated) {
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
  if (response.status === 204) {
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
    const error = code === undefined ? undefined : upstreamError(code);
    if (error) {
      return failure(response.status, error, headers);
    }
  }

  console.error(
    `${apiRequest.operationId} returned an unexpected ${response.status} response`
  );
  return failure(503, TRY_AGAIN, headers);
}

export function getMe(
  request: Request,
  context: Readonly<RouterContextProvider>
) {
  return callApi<User>(request, context, {
    operationId: "getMe",
  });
}
