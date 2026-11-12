import {
  authorizationCodeGrant,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  ClientSecretBasic,
  Configuration,
  randomPKCECodeVerifier,
  randomState,
  refreshTokenGrant,
  tokenRevocation,
  type TokenEndpointResponse,
} from "openid-client";
import { createCookie, type RouterContextProvider } from "react-router";
import { z } from "zod";
import {
  createSessionStorage,
  type AppSessionStorage,
  type SessionTokens,
} from "./session.server";
import { appEnvContext, authCacheContext } from "./context.server";
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

/**
 * Each sign-in's state and PKCE verifier travel in their own cookie, named
 * after the state, so sign-ins started in two tabs don't overwrite each
 * other.
 */
const AUTH0_STATE_COOKIE_PREFIX = "__Host-bt_auth0";
/** How long a sign-in at Auth0 may take (5 minutes). */
const AUTH0_STATE_MAX_AGE_SECONDS = 5 * 60;
/**
 * The shape of `randomState()` (32 random bytes, base64url). A callback
 * `state` of any other shape is refused before it can name a cookie.
 */
const STATE_FORMAT = /^[A-Za-z0-9_-]{43}$/;

/** What the state cookie holds: the state it was issued for, and its PKCE verifier. */
const auth0StateSchema = z.object({
  state: z.string(),
  codeVerifier: z.string(),
});

// The session storage and Auth0 client configuration, built on first use in
// each isolate.
let sessionStorage: AppSessionStorage | undefined;
let auth0Config: Configuration | undefined;

export function getOrCreateSessionStorage(
  env: Pick<AuthEnv, "AUTH_SESSION_SECRET">
): AppSessionStorage {
  sessionStorage ??= createSessionStorage(env.AUTH_SESSION_SECRET);
  return sessionStorage;
}

/**
 * The Auth0 client, configured statically: building the authorize URL
 * makes no network call (no discovery). The client authenticates to the
 * token and revocation endpoints with HTTP Basic ("Client Secret (Basic)"
 * in Auth0), and every call to Auth0 is bounded by AUTH0_TIMEOUT_MS.
 */
function getAuth0Config(env: AuthEnv): Configuration {
  if (auth0Config) return auth0Config;

  const origin = `https://${env.AUTH0_DOMAIN}`;
  const config = new Configuration(
    {
      issuer: `${origin}/`,
      authorization_endpoint: `${origin}/authorize`,
      token_endpoint: `${origin}/oauth/token`,
      revocation_endpoint: `${origin}/oauth/revoke`,
    },
    env.AUTH0_CLIENT_ID,
    // Auth0 signs ID tokens with RS256; `none` and HS256 are refused.
    { id_token_signed_response_alg: "RS256" },
    ClientSecretBasic(env.AUTH0_CLIENT_SECRET)
  );
  // In seconds. It can only be set here: openid-client reads no timeout
  // from the client metadata.
  config.timeout = AUTH0_TIMEOUT_MS / 1000;
  auth0Config = config;
  return config;
}

/** The callback URL this site registers with Auth0, and sends in both requests. */
function callbackUrl(env: AuthEnv): URL {
  return new URL(`${env.AUTH0_DEFAULT_REDIRECT_URI}/auth/callback`);
}

/** The signed cookie for the sign-in with `state` (a validated state). */
function auth0StateCookie(state: string, env: AuthEnv) {
  return createCookie(`${AUTH0_STATE_COOKIE_PREFIX}:${state}`, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: AUTH0_STATE_MAX_AGE_SECONDS,
    secrets: [env.AUTH_SESSION_SECRET],
  });
}

/**
 * The session's tokens from an Auth0 token response. A response without
 * `refresh_token` (rotation off, or no offline access) keeps
 * `previousRefreshToken`, and one without `expires_in` gets the default
 * lifetime.
 */
function sessionTokensFrom(
  tokens: TokenEndpointResponse,
  previousRefreshToken?: string
): SessionTokens {
  const refreshToken = tokens.refresh_token ?? previousRefreshToken;
  const expiresIn = tokens.expires_in ?? DEFAULT_TOKEN_EXPIRY_SECONDS;
  return {
    accessToken: tokens.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
    ...(refreshToken === undefined ? {} : { refreshToken }),
  };
}

/** Where /auth/login sends the reader, and the cookie that goes with it. */
type Auth0Login = {
  readonly authorizationUrl: URL;
  /** Set-Cookie for this sign-in's state and PKCE verifier. */
  readonly stateCookie: string;
};

/**
 * Start a sign-in at Auth0: a fresh state and PKCE (S256) verifier, kept
 * in a signed cookie for /auth/callback, and the authorize URL asking for
 * an access token for the API and a refresh token. The site reads no
 * profile claims, so it asks for none. Nothing from the request is
 * forwarded to Auth0.
 */
export async function startAuth0Login(env: AuthEnv): Promise<Auth0Login> {
  const state = randomState();
  const codeVerifier = randomPKCECodeVerifier();
  const authorizationUrl = buildAuthorizationUrl(getAuth0Config(env), {
    redirect_uri: callbackUrl(env).href,
    scope: "openid offline_access",
    audience: env.AUTH0_AUDIENCE,
    code_challenge: await calculatePKCECodeChallenge(codeVerifier),
    code_challenge_method: "S256",
    state,
  });
  return {
    authorizationUrl,
    stateCookie: await auth0StateCookie(state, env).serialize({
      state,
      codeVerifier,
    }),
  };
}

/** How the Auth0 round trip ended on /auth/callback. */
type Auth0CallbackOutcome =
  | { readonly kind: "signed-in"; readonly tokens: SessionTokens }
  /** The reader cancelled at Auth0, or Auth0 refused them. */
  | { readonly kind: "cancelled" }
  /** Anything else: a bad state, a failed code exchange, an Auth0 error. */
  | { readonly kind: "failed"; readonly error: unknown };

type Auth0Callback = {
  readonly outcome: Auth0CallbackOutcome;
  /** Set-Cookie clearing this sign-in's state cookie, when it had a valid state. */
  readonly clearStateCookie?: string;
};

/**
 * Finish the Auth0 round trip on /auth/callback (`url` is the router's
 * URL of the request).
 *
 * The callback's `state` must have `randomState()`'s shape before it names
 * a cookie, and must equal the state stored in that (signed) cookie. The
 * code is then exchanged with the cookie's PKCE verifier, bounded by
 * AUTH0_TIMEOUT_MS, and the ID token's issuer, audience, expiry and RS256
 * algorithm are checked. Its signature isn't: it comes straight from
 * Auth0's token endpoint over TLS (OIDC Core 3.1.3.7), and the site reads
 * none of its claims. There is no nonce: PKCE already binds the code to
 * this browser's sign-in (RFC 9700 §2.1.1).
 *
 * The state cookie is cleared whatever the outcome.
 */
export async function completeAuth0Login(
  request: Request,
  url: URL,
  env: AuthEnv
): Promise<Auth0Callback> {
  const state = url.searchParams.get("state");
  const validState = state !== null && STATE_FORMAT.test(state) ? state : null;
  const cookie = validState === null ? null : auth0StateCookie(validState, env);
  const clearStateCookie = cookie
    ? { clearStateCookie: await cookie.serialize("", { maxAge: 0 }) }
    : {};

  if (url.searchParams.get("error") === "access_denied") {
    return { outcome: { kind: "cancelled" }, ...clearStateCookie };
  }
  if (cookie === null) {
    return {
      outcome: {
        kind: "failed",
        error: new Error("The callback’s state is missing or malformed"),
      },
    };
  }

  const stored = auth0StateSchema.safeParse(
    await cookie.parse(request.headers.get("Cookie"))
  );
  if (!stored.success || stored.data.state !== validState) {
    return {
      outcome: {
        kind: "failed",
        error: new Error(
          "No valid state cookie for the callback’s state (missing, forged or expired)"
        ),
      },
      ...clearStateCookie,
    };
  }

  // The token request must send the redirect_uri the authorize request
  // sent, whatever host the callback arrived on (127.0.0.1 vs localhost,
  // a proxy): openid-client sends this URL without its query.
  const currentUrl = callbackUrl(env);
  currentUrl.search = url.search;
  try {
    const tokens = await authorizationCodeGrant(
      getAuth0Config(env),
      currentUrl,
      {
        pkceCodeVerifier: stored.data.codeVerifier,
        expectedState: stored.data.state,
      }
    );
    return {
      outcome: { kind: "signed-in", tokens: sessionTokensFrom(tokens) },
      ...clearStateCookie,
    };
  } catch (error) {
    return { outcome: { kind: "failed", error }, ...clearStateCookie };
  }
}

/**
 * Best effort on logout: revoke the refresh token at Auth0 (bounded by
 * AUTH0_TIMEOUT_MS), so a copied session cookie can't be renewed. A
 * failure is logged, never shown: the cookie is deleted either way.
 */
export async function revokeRefreshToken(
  refreshToken: string,
  env: AuthEnv
): Promise<void> {
  try {
    await tokenRevocation(getAuth0Config(env), refreshToken, {
      token_type_hint: "refresh_token",
    });
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

/** New tokens for `refreshToken`, or null when Auth0 won't give them. */
async function refreshTokens(
  refreshToken: string,
  env: AuthEnv
): Promise<SessionTokens | null> {
  try {
    const tokens = await refreshTokenGrant(getAuth0Config(env), refreshToken);
    return sessionTokensFrom(tokens, refreshToken);
  } catch (error) {
    console.error("Couldn’t refresh the access token:", error);
    return null;
  }
}

/**
 * The request's auth state from its session, refreshing an access token
 * that expires within five minutes.
 *
 * All loaders of one request share the first call's result (via the
 * request's `authCacheContext`), so a single-use refresh token is spent
 * only once.
 */
export async function getServerAuthContext(
  request: Request,
  context: Readonly<RouterContextProvider>
): Promise<AuthContextResult> {
  const authCache = context.get(authCacheContext);

  if (authCache.authContextPromise) {
    return authCache.authContextPromise;
  }

  const resultPromise = computeServerAuthContext(
    request,
    context.get(appEnvContext)
  );
  authCache.authContextPromise = resultPromise;
  return resultPromise;
}

/**
 * A token about to expire is refreshed when the session has a refresh
 * token. If that fails, the old token is used while it is still valid;
 * once it has expired the session is ended.
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

  if (!shouldRefreshToken(stored.expiresAt)) {
    return {
      authContext: { isAuthenticated: true, accessToken: stored.accessToken },
    };
  }

  const tokens = stored.refreshToken
    ? await refreshTokens(stored.refreshToken, env)
    : null;
  if (tokens) {
    session.set("tokens", tokens);
    return {
      authContext: { isAuthenticated: true, accessToken: tokens.accessToken },
      headers: new Headers({
        "Set-Cookie": await sessionStorage.commitSession(session),
      }),
    };
  }
  if (Date.now() < stored.expiresAt) {
    return {
      authContext: { isAuthenticated: true, accessToken: stored.accessToken },
    };
  }
  return {
    authContext: SIGNED_OUT,
    headers: new Headers({
      "Set-Cookie": await sessionStorage.destroySession(session),
    }),
  };
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
  context: Readonly<RouterContextProvider>
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
