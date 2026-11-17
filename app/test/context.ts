import { RouterContextProvider } from "react-router";
import { appEnvContext, authCacheContext } from "~/server/context.server";
import { parseEnv, type AppEnv } from "~/server/env.server";
import {
  createSessionStorage,
  type SessionTokens,
} from "~/server/session.server";

/** Shared fixtures for loader, action and server-module tests. */

export const API_BASE_URL = "https://api.test";
export const APP_ORIGIN = "https://app.test";

const parsed = parseEnv({
  BARDIC_TORCH_API_BASE_URL: API_BASE_URL,
  AUTH_SESSION_SECRET: "a-test-secret-of-at-least-32-characters",
  AUTH0_DOMAIN: "auth0.test",
  AUTH0_CLIENT_ID: "client-id",
  AUTH0_CLIENT_SECRET: "client-secret",
  AUTH0_DEFAULT_REDIRECT_URI: APP_ORIGIN,
  AUTH0_AUDIENCE: "audience",
});
if (!parsed.ok) throw new Error(parsed.problems.join("\n"));

const TEST_ENV: AppEnv = parsed.env;

/** The validated test environment, with `env` laid over it. */
export function testEnv(env: Partial<AppEnv> = {}): AppEnv {
  return { ...TEST_ENV, ...env };
}

/**
 * A request's React Router context as the Worker builds it
 * (app/server/worker.server.ts): the environment and a fresh auth cache.
 */
export function loadContext(env: Partial<AppEnv> = {}): RouterContextProvider {
  const context = new RouterContextProvider();
  context.set(appEnvContext, testEnv(env));
  context.set(authCacheContext, {});
  return context;
}

/**
 * The arguments React Router passes a loader or action for `request`: its
 * URL (without React Router's `.data` suffix, as the router normalises
 * it), the route's `pattern`, `params` and a fresh context.
 */
export function routeArgs(
  request: Request,
  {
    pattern = new URL(request.url).pathname,
    params = {},
    context = loadContext(),
  }: {
    readonly pattern?: string;
    readonly params?: Readonly<Record<string, string | undefined>>;
    readonly context?: Readonly<RouterContextProvider>;
  } = {}
) {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/\.data$/, "");
  return { request, url, pattern, params, context };
}

export function sessionTokens(
  overrides: Partial<SessionTokens> = {}
): SessionTokens {
  return {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresAt: Date.now() + 60 * 60 * 1000,
    ...overrides,
  };
}

/** A `Cookie` header value carrying a session with `tokens`. */
export async function sessionCookie(
  tokens: SessionTokens = sessionTokens()
): Promise<string> {
  const storage = createSessionStorage(TEST_ENV.AUTH_SESSION_SECRET);
  const session = await storage.getSession();
  session.set("tokens", tokens);
  return (await storage.commitSession(session)).split(";")[0] ?? "";
}

type FormRequestInit = {
  readonly method: string;
  readonly path: string;
  readonly form?: Readonly<Record<string, string>>;
  readonly headers?: Readonly<Record<string, string>>;
};

/** A same-origin, form-encoded request to the app. */
export function formRequest({
  method,
  path,
  form = {},
  headers = {},
}: FormRequestInit): Request {
  return new Request(`${APP_ORIGIN}${path}`, {
    method,
    headers: {
      Origin: APP_ORIGIN,
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body: new URLSearchParams(form).toString(),
  });
}
