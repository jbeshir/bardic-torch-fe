import { Authenticator } from "remix-auth";
import {
  Auth0Strategy,
  OAuth2RequestError,
  UnexpectedErrorResponseBodyError,
  UnexpectedResponseError,
} from "remix-auth-auth0";
import type { AppLoadContext } from "@remix-run/cloudflare";
import {
  createSessionStorage,
  type AppSessionStorage,
  type SessionTokens,
} from "./session.server";
import {
  AUTH0_TIMEOUT_MS,
  buildAuthorizationHeader,
  DEFAULT_TOKEN_EXPIRY_SECONDS,
  TOKEN_REFRESH_THRESHOLD_MS,
} from "~/constants/auth";

/** The variables Auth0 sign-in and the session need. */
type AuthEnv = {
  readonly AUTH_SESSION_SECRET: string;
  readonly AUTH0_DOMAIN: string;
  readonly AUTH0_CLIENT_ID: string;
  readonly AUTH0_CLIENT_SECRET: string;
  readonly AUTH0_DEFAULT_REDIRECT_URI: string;
  readonly AUTH0_AUDIENCE: string;
};

/** What Auth0's token endpoint answered, as arctic wraps it. */
type Auth0Tokens = Awaited<
  ReturnType<Auth0Strategy<SessionTokens>["refreshToken"]>
>;

// One session storage and authenticator per configuration, built on first
// use in each isolate.
const sessionStorageCache = new Map<string, AppSessionStorage>();
const authenticatorCache = new Map<string, Authenticator<SessionTokens>>();

export function getOrCreateSessionStorage(
  env: Pick<AuthEnv, "AUTH_SESSION_SECRET">
): AppSessionStorage {
  const cached = sessionStorageCache.get(env.AUTH_SESSION_SECRET);
  if (cached) return cached;

  const storage = createSessionStorage(env.AUTH_SESSION_SECRET);
  sessionStorageCache.set(env.AUTH_SESSION_SECRET, storage);
  return storage;
}

/**
 * The session's tokens from an Auth0 token response. arctic's accessors
 * throw for an absent field, so the optional ones are checked first: a
 * response without `refresh_token` (rotation off, or no offline access)
 * keeps `previousRefreshToken`, and one without `expires_in` gets the
 * default lifetime.
 */
function sessionTokensFrom(
  tokens: Auth0Tokens,
  previousRefreshToken?: string
): SessionTokens {
  const refreshToken = tokens.hasRefreshToken()
    ? tokens.refreshToken()
    : previousRefreshToken;
  const expiresIn =
    "expires_in" in tokens.data && typeof tokens.data.expires_in === "number"
      ? tokens.data.expires_in
      : DEFAULT_TOKEN_EXPIRY_SECONDS;
  return {
    accessToken: tokens.accessToken(),
    expiresAt: Date.now() + expiresIn * 1000,
    ...(refreshToken === undefined ? {} : { refreshToken }),
  };
}

export function getOrCreateAuthenticator(
  env: AuthEnv
): Authenticator<SessionTokens> {
  const cacheKey = `${env.AUTH_SESSION_SECRET}:${env.AUTH0_DOMAIN}:${env.AUTH0_CLIENT_ID}`;
  const cached = authenticatorCache.get(cacheKey);
  if (cached) return cached;

  const authenticator = new Authenticator<SessionTokens>();
  authenticator.use(
    new Auth0Strategy<SessionTokens>(
      {
        domain: env.AUTH0_DOMAIN,
        clientId: env.AUTH0_CLIENT_ID,
        clientSecret: env.AUTH0_CLIENT_SECRET,
        redirectURI: `${env.AUTH0_DEFAULT_REDIRECT_URI}/auth/callback`,
        // An access token for the API and a refresh token; the site reads
        // no profile claims, so it asks for none.
        scopes: ["openid", "offline_access"],
        audience: env.AUTH0_AUDIENCE,
        // State and PKCE verifier for the Auth0 round trip (5 minutes).
        cookie: {
          name: "__Host-bt_auth0",
          httpOnly: true,
          secure: true,
          sameSite: "Lax",
          path: "/",
        },
      },
      async ({ tokens }) => sessionTokensFrom(tokens)
    )
  );
  authenticatorCache.set(cacheKey, authenticator);
  return authenticator;
}

function getAuth0Strategy(env: AuthEnv): Auth0Strategy<SessionTokens> {
  const strategy =
    getOrCreateAuthenticator(env).get<Auth0Strategy<SessionTokens>>("auth0");
  if (!strategy) throw new Error("The Auth0 strategy is not registered");
  return strategy;
}

/**
 * `promise`, or a rejection after AUTH0_TIMEOUT_MS. arctic's requests take
 * no AbortSignal, so a hanging Auth0 is raced instead.
 */
async function withinAuth0Timeout<T>(
  promise: Promise<T>,
  what: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Auth0 ${what} timed out`)),
      AUTH0_TIMEOUT_MS
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Finish the Auth0 round trip on /auth/callback: check the state, exchange
 * the code (bounded by AUTH0_TIMEOUT_MS) and return the session's tokens.
 * Throws when sign-in didn't complete.
 */
export function completeAuth0Login(
  request: Request,
  env: AuthEnv
): Promise<SessionTokens> {
  return withinAuth0Timeout(
    getOrCreateAuthenticator(env).authenticate("auth0", request),
    "code exchange"
  );
}

/**
 * Best effort on logout: revoke the refresh token at Auth0, so a copied
 * session cookie can't be renewed. A failure is logged, never shown: the
 * cookie is deleted either way.
 */
export async function revokeRefreshToken(
  refreshToken: string,
  env: AuthEnv
): Promise<void> {
  try {
    await withinAuth0Timeout(
      getAuth0Strategy(env).revokeToken(refreshToken),
      "token revocation"
    );
  } catch (error) {
    console.error("Couldn’t revoke the refresh token at logout:", error);
  }
}

/** Whether the request may use the API, and with which token. */
type ServerAuthContext =
  | { readonly isAuthenticated: true; readonly accessToken: string }
  | { readonly isAuthenticated: false };

export type AuthContextResult = {
  readonly authContext: ServerAuthContext;
  /** Set-Cookie for a refreshed or ended session, for the response. */
  readonly headers?: Headers;
};

const SIGNED_OUT: ServerAuthContext = { isAuthenticated: false };

/** The token expires within the refresh threshold (or already has). */
function shouldRefreshToken(expiresAt: number): boolean {
  return Date.now() > expiresAt - TOKEN_REFRESH_THRESHOLD_MS;
}

type RefreshOutcome =
  | { readonly kind: "refreshed"; readonly tokens: SessionTokens }
  /** Auth0 refused the refresh token (e.g. `invalid_grant`): it is dead. */
  | { readonly kind: "rejected" }
  /** Auth0 didn't answer usefully (network, 5xx, timeout): try next time. */
  | { readonly kind: "unavailable" };

/**
 * Whether Auth0 refused the refresh token itself. arctic reads an OAuth
 * error body only from a 400 or 401; Auth0 answers `invalid_grant` with a
 * 403, which arctic reports by status alone. Any client error but a timeout
 * or rate limit is a refusal; a 5xx, a network failure or a hang is not.
 */
function isRefusal(error: unknown): boolean {
  if (error instanceof OAuth2RequestError) return true;
  if (
    error instanceof UnexpectedResponseError ||
    error instanceof UnexpectedErrorResponseBodyError
  ) {
    return (
      error.status >= 400 &&
      error.status < 500 &&
      error.status !== 408 &&
      error.status !== 429
    );
  }
  return false;
}

async function refreshTokens(
  refreshToken: string,
  env: AuthEnv
): Promise<RefreshOutcome> {
  try {
    const tokens = await withinAuth0Timeout(
      getAuth0Strategy(env).refreshToken(refreshToken),
      "token refresh"
    );
    return {
      kind: "refreshed",
      tokens: sessionTokensFrom(tokens, refreshToken),
    };
  } catch (error) {
    if (isRefusal(error)) {
      console.warn("Auth0 refused the refresh token:", error);
      return { kind: "rejected" };
    }
    console.error("Couldn’t refresh the access token:", error);
    return { kind: "unavailable" };
  }
}

/**
 * The request's auth state from its session, refreshing an access token
 * that expires within five minutes.
 *
 * All loaders of one request share the first call's result (via
 * `context.authCache`), so a single-use refresh token is spent only once.
 */
export async function getServerAuthContext(
  request: Request,
  context: AppLoadContext
): Promise<AuthContextResult> {
  const { authCache } = context;

  if (authCache.authContextPromise) {
    return authCache.authContextPromise;
  }

  const resultPromise = computeServerAuthContext(
    request,
    context.cloudflare.env
  );
  authCache.authContextPromise = resultPromise;
  return resultPromise;
}

/**
 * A session whose refresh token Auth0 refused, or whose token expired with
 * no way to renew it, is ended. When Auth0 is merely unavailable the session
 * is kept: its token is used while it is still valid, and once it has
 * expired the request is signed out without touching the cookie, so the
 * next request tries the refresh again.
 */
async function computeServerAuthContext(
  request: Request,
  env: AuthEnv
): Promise<AuthContextResult> {
  const sessionStorage = getOrCreateSessionStorage(env);
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );
  const stored = session.get("tokens");

  if (!stored) return { authContext: SIGNED_OUT };

  const current: AuthContextResult = {
    authContext: { isAuthenticated: true, accessToken: stored.accessToken },
  };
  const stillValid = Date.now() < stored.expiresAt;
  if (!shouldRefreshToken(stored.expiresAt)) return current;

  const outcome: RefreshOutcome = stored.refreshToken
    ? await refreshTokens(stored.refreshToken, env)
    : { kind: stillValid ? "unavailable" : "rejected" };

  switch (outcome.kind) {
    case "refreshed": {
      session.set("tokens", outcome.tokens);
      return {
        authContext: {
          isAuthenticated: true,
          accessToken: outcome.tokens.accessToken,
        },
        headers: new Headers({
          "Set-Cookie": await sessionStorage.commitSession(session),
        }),
      };
    }
    case "unavailable":
      return stillValid ? current : { authContext: SIGNED_OUT };
    case "rejected":
      return {
        authContext: SIGNED_OUT,
        headers: new Headers({
          "Set-Cookie": await sessionStorage.destroySession(session),
        }),
      };
  }
}

type AuthenticatedFetchResult = {
  readonly isAuthenticated: boolean;
  /** `fetch` with the session's bearer token added. */
  readonly authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  /** Set-Cookie for a refreshed or ended session, for the response. */
  readonly headers?: Headers;
};

/**
 * A fetch that sends the session's access token (refreshed first when it
 * is about to expire, see getServerAuthContext), and whether there is one,
 * so callers can skip requests that would fail signed out.
 */
export async function createAuthenticatedFetch(
  request: Request,
  context: AppLoadContext
): Promise<AuthenticatedFetchResult> {
  const { authContext, headers } = await getServerAuthContext(request, context);

  return {
    isAuthenticated: authContext.isAuthenticated,
    authFetch: (url, init) => {
      const requestHeaders = new Headers(init?.headers);
      if (authContext.isAuthenticated) {
        requestHeaders.set(
          "Authorization",
          buildAuthorizationHeader(authContext.accessToken)
        );
      }
      return fetch(url, { ...init, headers: requestHeaders });
    },
    ...(headers ? { headers } : {}),
  };
}
