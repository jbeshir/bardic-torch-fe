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
import {
  UNEXPECTED_ANSWER,
  type ProxyBody,
  type ProxyError,
  type ProxyErrorCode,
} from "~/schemas/proxy";
import {
  createAuthenticatedFetch,
  getOrCreateSessionStorage,
  getServerAuthContext,
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

/** The codes this module answers with: not the CSRF check's or the browser's. */
type ErrorCode = Exclude<
  ProxyErrorCode,
  "forbidden" | "offline" | "unexpected_response"
>;

/** An error the app reports, with its own copy (see `upstreamError`). */
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

/**
 * The (path, method) pair at which `paths` declares `operation`. Methods a
 * path doesn't have are typed `never` there, which would match anything,
 * so they are excluded first.
 */
type EndpointOf<Operation> = {
  [Path in keyof paths]: {
    [M in Method]: [paths[Path][Lowercase<M>]] extends [never]
      ? never
      : [paths[Path][Lowercase<M>]] extends [Operation]
        ? { readonly path: Path; readonly method: M }
        : never;
  }[Method];
}[keyof paths];

/** Where each FE1 operation lives; the compiler checks it against the spec. */
const ENDPOINTS = {
  getMe: { method: "GET", path: "/v1/me" },
  updateMe: { method: "PATCH", path: "/v1/me" },
  listAPITokens: { method: "GET", path: "/v1/tokens" },
  createAPIToken: { method: "POST", path: "/v1/tokens" },
  revokeAPIToken: { method: "DELETE", path: "/v1/tokens/{token_id}" },
} as const satisfies {
  readonly [Id in keyof operations]?: EndpointOf<operations[Id]>;
};

type OperationId = keyof typeof ENDPOINTS;

type ApiRequest<T> = {
  readonly operationId: OperationId;
  readonly params?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly schema: z.ZodType<T>;
};

/**
 * How long the proxy waits for the API (its answer and the whole body)
 * before giving up with a 504, so a hung upstream still ends every form's
 * request with a visible Alert instead of a button that stays busy.
 */
const UPSTREAM_TIMEOUT_MS = 10_000;

const TRY_AGAIN = "We couldn’t do that just now. Try again shortly.";

const SIGNED_OUT: ApiError = {
  code: "unauthenticated",
  message: "Log in to continue.",
};

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
          "You’ve been signed out. Log in again and we’ll bring you back here.",
      };
    case "user_blocked":
      return {
        code,
        message:
          "Your account is blocked, so you can’t make changes. Contact the Bardic Torch team if you think this is a mistake.",
      };
    case "api_token_not_allowed":
      return {
        code,
        message:
          "API tokens can’t manage API tokens. Log in on the website to do this.",
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
            : "We couldn’t find what you asked for. Reload the page and try again.",
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
  const path = ENDPOINTS[request.operationId].path.replace(
    /\{(\w+)\}/g,
    (_match, name: string) => encodeURIComponent(request.params?.[name] ?? "")
  );
  return `${base}${path}`;
}

/** `text` as JSON: null when empty, undefined when it isn't JSON. */
function parseJson(text: string): unknown {
  if (text === "") return null;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Rejects with the signal's reason once it aborts. */
function aborted(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    if (signal.aborted) reject(signal.reason);
    signal.addEventListener("abort", () => reject(signal.reason), {
      once: true,
    });
  });
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

  if (!auth.isAuthenticated) return failure(401, SIGNED_OUT, headers);

  // The timeout covers the body too: a body that stalls or breaks off
  // ends in the same 504/502 as a request that never got an answer.
  const signal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
  let response: Response;
  let text: string;
  try {
    response = await auth.authFetch(
      upstreamUrl(env.BARDIC_TORCH_API_BASE_URL, apiRequest),
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
    console.error(`${apiRequest.operationId} failed:`, error);
    if (isTimeout(error)) {
      return failure(
        504,
        {
          code: "upstream_unavailable",
          message: "Our servers took too long to answer. Try again shortly.",
        },
        headers
      );
    }
    return failure(
      502,
      {
        code: "upstream_unavailable",
        message: "We couldn’t reach our servers. Try again shortly.",
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

  const payload = parseJson(text);
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
      message: UNEXPECTED_ANSWER,
    },
    headers
  );
}

/**
 * The body as text, read until it ends or passes `limit` bytes (null), so
 * an oversized body is never held in memory, whatever Content-Length says.
 */
async function readLimited(
  request: Request,
  limit: number
): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Read and validate a proxy route's form-encoded body. Other content types
 * get a 415, bodies over 8 KB a 413 and invalid fields a 400 listing them.
 */
async function readFormBody<S extends z.ZodType>(
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
  const text =
    declaredLength > MAX_BODY_BYTES
      ? null
      : await readLimited(request, MAX_BODY_BYTES).catch(() => undefined);
  if (text === null) {
    return failure(413, {
      code: "request_too_large",
      message: "The form is too large to send.",
    });
  }
  if (text === undefined) {
    return failure(400, {
      code: "invalid_request",
      message: "The form didn’t arrive in full. Try again.",
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
 * A proxy route's answer to a form submission: signed out gets a 401
 * before the body is read; then the form is read and validated
 * (`readFormBody`) and `send` makes the API call with it. A refreshed
 * session cookie goes out on every answer, including the form's errors.
 */
export async function proxyForm<S extends z.ZodType>(
  request: Request,
  context: AppLoadContext,
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
    body,
    schema: userSchema,
  });
}

export function listApiTokens(request: Request, context: AppLoadContext) {
  return callApi(request, context, {
    operationId: "listAPITokens",
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
    params: { token_id: tokenId },
    schema: z.null(),
  });
}
