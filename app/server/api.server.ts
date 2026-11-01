import type { AppLoadContext } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import { z } from "zod";
import type { operations, paths } from "~/api/schema.gen";
import {
  apiTokenListSchema,
  createdApiTokenSchema,
  upstreamErrorSchema,
  userSchema,
  type UpstreamErrorCode,
  type User,
} from "~/schemas/api";
import {
  ACTIVE_TOKEN_LIMIT,
  DISPLAY_NAME_RULE,
  TOKEN_NAME_RULE,
} from "~/schemas/rules";
import type { ProxyBody, ProxyError } from "~/schemas/proxy";
import {
  createAuthenticatedFetch,
  getOrCreateSessionStorage,
} from "./auth.server";

/**
 * Server-side client for the Bardic Torch API. Every call is authenticated
 * with the session's bearer token, validates the upstream body with zod and
 * resolves to an `ApiResult`; nothing throws. Only the headers built here
 * reach the API, so a client's Cookie or Authorization is never forwarded.
 *
 * Upstream error messages are not meant for end users, so every error the
 * app sees carries copy written here, chosen by the upstream `code`.
 */

type ErrorCode =
  | UpstreamErrorCode
  | "upstream_unavailable"
  | "bad_gateway"
  | "method_not_allowed";

/** `fields` lists per-field problems with a request body, shown next to the fields. */
type ApiError = ProxyError & { readonly code: ErrorCode };

type ApiResult<T> = (
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: ApiError }
) & {
  readonly status: number;
  /** Headers the caller's response must carry, such as a refreshed session. */
  readonly headers: Headers;
};

/** Largest form body the proxy routes accept. */
const MAX_BODY_BYTES = 8 * 1024;

type Method = "GET" | "PATCH" | "POST" | "DELETE";

type OperationId =
  | "getMe"
  | "updateMe"
  | "listAPITokens"
  | "createAPIToken"
  | "revokeAPIToken";

type ApiRequest<T> = {
  readonly operationId: OperationId;
  readonly method: Method;
  readonly path: keyof paths;
  readonly params?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly schema: z.ZodType<T>;
};

/**
 * How long the proxy waits for the API before giving up with a 504, so a
 * hung upstream still ends every form's request with a visible Alert
 * instead of a button that stays busy.
 */
export const UPSTREAM_TIMEOUT_MS = 10_000;

const TRY_AGAIN = "Bardic Torch couldn't do that just now. Try again shortly.";

/** What the user is told for an upstream error, per operation. */
function upstreamError(
  operationId: OperationId,
  code: UpstreamErrorCode
): ApiError {
  switch (code) {
    case "unauthenticated":
      return {
        code,
        message:
          "You've been signed out. Log in again and we'll bring you back here.",
      };
    case "user_blocked":
      return {
        code,
        message:
          "Your account is blocked, so you can't make changes. Contact the Bardic Torch team if you think this is a mistake.",
      };
    case "api_token_not_allowed":
      return {
        code,
        message:
          "API tokens can't manage API tokens. Log in on the website to do this.",
      };
    case "token_limit_reached":
      return {
        code,
        message: `You already have ${ACTIVE_TOKEN_LIMIT} API tokens, the most allowed. Revoke one before creating another.`,
      };
    case "moderator_required":
      return { code, message: "Only moderators can do that." };
    case "request_too_large":
      return { code, message: "The form is too large to send." };
    case "not_found":
      return {
        code,
        message:
          operationId === "revokeAPIToken"
            ? "That token no longer exists. Reload the page to see your current tokens."
            : "Bardic Torch couldn't find what you asked for. Reload the page and try again.",
      };
    case "conflict":
      return {
        code,
        message:
          "Something changed while you were editing. Reload the page and try again.",
      };
    case "invalid_request":
      if (operationId === "updateMe") {
        return {
          code,
          message: "Check the display name.",
          fields: [{ field: "display_name", message: DISPLAY_NAME_RULE }],
        };
      }
      if (operationId === "createAPIToken") {
        return {
          code,
          message: "Check the token name.",
          fields: [{ field: "name", message: TOKEN_NAME_RULE }],
        };
      }
      return { code, message: TRY_AGAIN };
    case "unsupported_media_type":
    case "internal":
    case "unavailable":
      return { code, message: TRY_AGAIN };
  }
}

function failure(
  status: number,
  error: ApiError,
  headers = new Headers()
): ApiResult<never> {
  return { ok: false, status, error, headers };
}

function upstreamUrl(base: string, request: ApiRequest<unknown>): string {
  const path = request.path.replace(/\{(\w+)\}/g, (_match, name: string) =>
    encodeURIComponent(request.params?.[name] ?? "")
  );
  return `${base}${path}`;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === "") return null;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** `AbortSignal.timeout` rejects with a DOMException named TimeoutError. */
function isTimeout(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "TimeoutError"
  );
}

async function callApi<T>(
  request: Request,
  context: AppLoadContext,
  apiRequest: ApiRequest<T>
): Promise<ApiResult<T>> {
  const env = context.cloudflare.env;
  const auth = await createAuthenticatedFetch(request, context);
  const headers = new Headers(auth.headers);

  if (!auth.isAuthenticated) {
    return failure(
      401,
      { code: "unauthenticated", message: "Log in to continue." },
      headers
    );
  }

  let response: Response;
  try {
    response = await auth.authFetch(
      upstreamUrl(env.BARDIC_TORCH_API_BASE_URL, apiRequest),
      {
        method: apiRequest.method,
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
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      }
    );
  } catch (error) {
    console.error(`${apiRequest.operationId} failed:`, error);
    if (isTimeout(error)) {
      return failure(
        504,
        {
          code: "upstream_unavailable",
          message: "Bardic Torch took too long to answer. Try again shortly.",
        },
        headers
      );
    }
    return failure(
      502,
      {
        code: "upstream_unavailable",
        message: "We couldn't reach Bardic Torch. Try again shortly.",
      },
      headers
    );
  }

  if (response.status === 401) {
    const sessionStorage = getOrCreateSessionStorage(env);
    const session = await sessionStorage.getSession(
      request.headers.get("Cookie")
    );
    headers.set("Set-Cookie", await sessionStorage.destroySession(session));
    return failure(
      401,
      upstreamError(apiRequest.operationId, "unauthenticated"),
      headers
    );
  }

  const payload = await readJson(response);
  if (response.ok) {
    const parsed = apiRequest.schema.safeParse(payload);
    if (parsed.success) {
      return { ok: true, status: response.status, data: parsed.data, headers };
    }
  } else if (response.status >= 400) {
    const parsed = upstreamErrorSchema.safeParse(payload);
    if (parsed.success) {
      return failure(
        response.status,
        upstreamError(apiRequest.operationId, parsed.data.code),
        headers
      );
    }
  }

  console.error(
    `${apiRequest.operationId} returned an unexpected ${response.status} response`
  );
  return failure(
    502,
    {
      code: "bad_gateway",
      message: "Bardic Torch sent an unexpected response. Try again shortly.",
    },
    headers
  );
}

/**
 * Read and validate a proxy route's form-encoded body. Other content types
 * get a 415, bodies over 8 KB a 413 and invalid fields a 400 listing them.
 */
export async function readFormBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S
): Promise<
  { readonly ok: true; readonly data: z.output<S> } | ApiResult<never>
> {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!/^application\/x-www-form-urlencoded\s*(;|$)/i.test(contentType)) {
    return failure(415, {
      code: "unsupported_media_type",
      message: "Send the form as form data.",
    });
  }
  const declaredLength = Number(request.headers.get("Content-Length") ?? 0);
  const text = declaredLength > MAX_BODY_BYTES ? "" : await request.text();
  if (
    declaredLength > MAX_BODY_BYTES ||
    new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES
  ) {
    return failure(413, {
      code: "request_too_large",
      message: "The form is too large to send.",
    });
  }

  const parsed = schema.safeParse(
    Object.fromEntries(new URLSearchParams(text))
  );
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
 * The JSON response of a proxy route: the result without its headers, never
 * cached. A 204 becomes a 200 so fetchers can read the body.
 */
export function proxyResponse(result: ApiResult<unknown>): Response {
  const headers = new Headers(result.headers);
  headers.set("Cache-Control", "no-store");
  return json<ProxyBody<unknown>>(
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

export function getMe(request: Request, context: AppLoadContext) {
  return callApi<User>(request, context, {
    operationId: "getMe",
    method: "GET",
    path: "/v1/me",
    schema: userSchema,
  });
}

export function updateMe(
  request: Request,
  context: AppLoadContext,
  body: RequestBody<"updateMe">
) {
  return callApi(request, context, {
    operationId: "updateMe",
    method: "PATCH",
    path: "/v1/me",
    body,
    schema: userSchema,
  });
}

export function listApiTokens(request: Request, context: AppLoadContext) {
  return callApi(request, context, {
    operationId: "listAPITokens",
    method: "GET",
    path: "/v1/tokens",
    schema: apiTokenListSchema,
  });
}

export function createApiToken(
  request: Request,
  context: AppLoadContext,
  body: RequestBody<"createAPIToken">
) {
  return callApi(request, context, {
    operationId: "createAPIToken",
    method: "POST",
    path: "/v1/tokens",
    body,
    schema: createdApiTokenSchema,
  });
}

export function revokeApiToken(
  request: Request,
  context: AppLoadContext,
  tokenId: string
) {
  return callApi(request, context, {
    operationId: "revokeAPIToken",
    method: "DELETE",
    path: "/v1/tokens/{token_id}",
    params: { token_id: tokenId },
    schema: z.null(),
  });
}
