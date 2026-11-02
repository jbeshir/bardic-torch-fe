import { http, HttpResponse } from "msw/http";
import { createCookie } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TOKEN_EXPIRY_SECONDS } from "~/constants/auth";
import { getOrCreateSessionStorage } from "~/server/auth.server";
import type { AppEnv } from "~/server/env.server";
import { createReturnToCookie } from "~/server/return-to.server";
import {
  AUTH0_TOKEN_ENDPOINT,
  hangingAuth0,
  idToken,
} from "~/test/auth0-fixture";
import { loadContext, routeArgs, testEnv } from "~/test/context";
import { loader as callback } from "./auth.callback";
import { loader as login } from "./auth.login";
import { serveMocks } from "~/test/msw";

const SECRET = testEnv().AUTH_SESSION_SECRET;
/** Each sign-in's state cookie is named `${STATE_COOKIE_PREFIX}:<state>`. */
const STATE_COOKIE_PREFIX = "__Host-bt_auth0";

/** What the fake Auth0 token endpoint received. */
type TokenRequest = {
  readonly form: URLSearchParams;
  readonly authorization: string | null;
};
const tokenRequests: TokenRequest[] = [];
/** Codes the fake Auth0 token endpoint received. */
const exchangedCodes: string[] = [];
const { server } = serveMocks();

function auth0TokenEndpoint(respond: () => Response | Promise<Response>) {
  server.use(
    http.post(AUTH0_TOKEN_ENDPOINT, async ({ request }) => {
      const form = new URLSearchParams(await request.text());
      tokenRequests.push({
        form,
        authorization: request.headers.get("Authorization"),
      });
      exchangedCodes.push(form.get("code") ?? "");
      return respond();
    })
  );
}

/** Auth0's answer to a code exchange, with a fresh RS256 ID token. */
async function auth0Tokens(body: Readonly<Record<string, unknown>>) {
  return HttpResponse.json({ id_token: await idToken(), ...body });
}

beforeEach(() => {
  auth0TokenEndpoint(() =>
    auth0Tokens({
      access_token: "access-42",
      refresh_token: "refresh-42",
      expires_in: 3600,
      token_type: "Bearer",
    })
  );
});
afterEach(() => {
  exchangedCodes.length = 0;
  tokenRequests.length = 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function cookiePairs(response: Response): string[] {
  return response.headers
    .getSetCookie()
    .map(value => value.split(";")[0] ?? "");
}

/** Start a login and return what the browser brings back to the callback. */
async function startLogin(
  returnTo?: string,
  {
    origin = "https://app.test",
    env = {},
  }: { readonly origin?: string; readonly env?: Partial<AppEnv> } = {}
) {
  const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
  const response = await login(
    routeArgs(new Request(`${origin}/auth/login${query}`), {
      context: loadContext(env),
    })
  );
  const location = new URL(response.headers.get("Location") ?? "");
  return {
    state: location.searchParams.get("state") ?? "",
    redirectUri: location.searchParams.get("redirect_uri"),
    cookies: cookiePairs(response),
  };
}

function runCallback(
  query: string,
  cookies: readonly string[],
  {
    origin = "https://app.test",
    env = {},
  }: { readonly origin?: string; readonly env?: Partial<AppEnv> } = {}
) {
  return callback(
    routeArgs(
      new Request(`${origin}/auth/callback?${query}`, {
        headers: { Cookie: cookies.join("; ") },
      }),
      { context: loadContext(env) }
    )
  );
}

/** The sign-in state cookies `response` sets (or clears). */
function stateCookiesSet(response: Response): string[] {
  return response.headers
    .getSetCookie()
    .filter(value => value.startsWith(`${STATE_COOKIE_PREFIX}:`));
}

/** A state cookie signed with the session secret, as /auth/login writes one. */
async function stateCookie(
  name: string,
  value: { readonly state: string; readonly codeVerifier: string }
) {
  const cookie = createCookie(`${STATE_COOKIE_PREFIX}:${name}`, {
    secure: true,
    path: "/",
    secrets: [SECRET],
  });
  return (await cookie.serialize(value)).split(";")[0] ?? "";
}

/** A state of randomState()'s shape (43 base64url characters). */
const OTHER_STATE = "A".repeat(43);

async function sessionTokensFrom(response: Response) {
  const session = await getOrCreateSessionStorage({
    AUTH_SESSION_SECRET: SECRET,
  }).getSession(
    cookiePairs(response).find(pair => pair.startsWith("__Host-bt_session="))
  );
  return session.get("tokens");
}

function expectReturnToCleared(response: Response) {
  const cleared = response.headers
    .getSetCookie()
    .find(value => value.startsWith("__Host-bt_return_to="));
  expect(cleared).toMatch(/^__Host-bt_return_to=[^;]*;/);
  expect(cleared).toContain("Max-Age=0");
}

describe("/auth/callback", () => {
  it("creates the session and redirects to the returnTo stored at login", async () => {
    const { state, cookies } = await startLogin("/help/licence");
    const response = await runCallback(`code=abc&state=${state}`, cookies);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/help/licence");
    expect(exchangedCodes).toEqual(["abc"]);
    expect(await sessionTokensFrom(response)).toEqual({
      accessToken: "access-42",
      refreshToken: "refresh-42",
      expiresAt: expect.any(Number),
    });
    expectReturnToCleared(response);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("signs in when Auth0 issues no refresh token or expiry (no offline access)", async () => {
    auth0TokenEndpoint(() =>
      auth0Tokens({ access_token: "access-42", token_type: "Bearer" })
    );
    const before = Date.now();
    const { state, cookies } = await startLogin("/settings");
    const response = await runCallback(`code=abc&state=${state}`, cookies);

    expect(response.headers.get("Location")).toBe("/settings");
    const tokens = await sessionTokensFrom(response);
    expect(tokens).toEqual({
      accessToken: "access-42",
      expiresAt: expect.any(Number),
    });
    expect(tokens?.expiresAt).toBeGreaterThanOrEqual(
      before + DEFAULT_TOKEN_EXPIRY_SECONDS * 1000
    );
  });

  it("goes back to the page signed out when the code exchange hangs", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { state, cookies } = await startLogin("/help");
    const hang = hangingAuth0();
    const response = await runCallback(`code=abc&state=${state}`, cookies);
    expect(hang).toHaveBeenCalledWith(AUTH0_TOKEN_ENDPOINT, expect.anything());
    expect(response.headers.get("Location")).toBe("/help");
    expect(await sessionTokensFrom(response)).toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      "Authentication callback error:",
      expect.objectContaining({ code: "OAUTH_TIMEOUT" })
    );
  });

  it("ignores a returnTo in the callback's query string", async () => {
    const { state, cookies } = await startLogin("/help");
    const response = await runCallback(
      `code=abc&state=${state}&returnTo=%2Fsettings`,
      cookies
    );
    expect(response.headers.get("Location")).toBe("/help");
    expect(await sessionTokensFrom(response)).toBeDefined();
  });

  it("validates the stored returnTo again", async () => {
    const { state, cookies } = await startLogin();
    const forged = await createReturnToCookie(SECRET).serialize("//evil.com");
    const response = await runCallback(`code=abc&state=${state}`, [
      ...cookies.filter(pair => !pair.startsWith("__Host-bt_return_to=")),
      forged.split(";")[0] ?? "",
    ]);
    expect(response.headers.get("Location")).toBe("/");
    expect(await sessionTokensFrom(response)).toBeDefined();
  });

  it("ignores a returnTo cookie signed with another secret", async () => {
    const { state, cookies } = await startLogin();
    const foreign = await createReturnToCookie(
      "another-secret-of-at-least-32-chars"
    ).serialize("/settings");
    const response = await runCallback(`code=abc&state=${state}`, [
      ...cookies.filter(pair => !pair.startsWith("__Host-bt_return_to=")),
      foreign.split(";")[0] ?? "",
    ]);
    expect(response.headers.get("Location")).toBe("/");
    expect(await sessionTokensFrom(response)).toBeDefined();
  });

  it.each([
    ["a state that doesn’t match the cookie", "code=abc&state=forged"],
    ["an Auth0 server error", "error=server_error&error_description=no"],
  ])(
    "on %s goes back to the page logged out, logs an error and clears returnTo",
    async (_name, query) => {
      const error = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const { state, cookies } = await startLogin("/help");
      const response = await runCallback(
        query.includes("state=") ? query : `${query}&state=${state}`,
        cookies
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/help");
      expect(await sessionTokensFrom(response)).toBeUndefined();
      expectReturnToCleared(response);
      expect(exchangedCodes).toEqual([]);
      expect(error).toHaveBeenCalled();
    }
  );

  it("when the reader cancels at Auth0, goes back to the page logged out with a warning, not an error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { state, cookies } = await startLogin("/settings");
    const response = await runCallback(
      `error=access_denied&error_description=cancelled&state=${state}`,
      cookies
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/settings");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await sessionTokensFrom(response)).toBeUndefined();
    expectReturnToCleared(response);
    expect(exchangedCodes).toEqual([]);
    expect(warn).toHaveBeenCalledWith("Sign-in cancelled or refused at Auth0");
    expect(error).not.toHaveBeenCalled();
  });

  it("goes back to the page without a session when the code exchange fails", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    auth0TokenEndpoint(() =>
      HttpResponse.json({ error: "invalid_grant" }, { status: 400 })
    );
    const { state, cookies } = await startLogin("/help");
    const response = await runCallback(`code=abc&state=${state}`, cookies);

    expect(response.headers.get("Location")).toBe("/help");
    expect(await sessionTokensFrom(response)).toBeUndefined();
    expect(error).toHaveBeenCalled();
  });
});

describe("/auth/callback state", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  /** The callback failed: back to the page signed out, nothing exchanged. */
  async function expectSignInRefused(response: Response) {
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/help");
    expect(await sessionTokensFrom(response)).toBeUndefined();
    expect(exchangedCodes).toEqual([]);
    expectReturnToCleared(response);
    expect(console.error).toHaveBeenCalledWith(
      "Authentication callback error:",
      expect.any(Error)
    );
  }

  it("refuses a state containing ;, reading and clearing no cookie under that name", async () => {
    const { state, cookies } = await startLogin("/help");
    const response = await runCallback(
      `code=abc&state=${encodeURIComponent(`${state};x`)}`,
      cookies
    );
    await expectSignInRefused(response);
    expect(stateCookiesSet(response)).toEqual([]);
  });

  it("refuses a state of the wrong length, even with a validly signed cookie for it", async () => {
    const { cookies } = await startLogin("/help");
    const short = "A".repeat(42);
    const forged = await stateCookie(short, {
      state: short,
      codeVerifier: "v".repeat(43),
    });
    const response = await runCallback(`code=abc&state=${short}`, [
      ...cookies,
      forged,
    ]);
    await expectSignInRefused(response);
    expect(stateCookiesSet(response)).toEqual([]);
  });

  it("refuses a state whose sign-in this browser didn't start, though it holds another's cookie", async () => {
    const { cookies } = await startLogin("/help");
    const response = await runCallback(
      `code=abc&state=${OTHER_STATE}`,
      cookies
    );
    await expectSignInRefused(response);
    expect(stateCookiesSet(response).map(value => value.split("=")[0])).toEqual(
      [`${STATE_COOKIE_PREFIX}:${OTHER_STATE}`]
    );
  });

  it("refuses a state cookie whose signature was tampered with", async () => {
    const { state, cookies } = await startLogin("/help");
    // Change the signed value's first character: the signature no longer fits.
    const tampered = cookies.map(pair => {
      if (!pair.startsWith(`${STATE_COOKIE_PREFIX}:`)) return pair;
      const start = pair.indexOf("=") + 1;
      const changed = pair[start] === "e" ? "f" : "e";
      return `${pair.slice(0, start)}${changed}${pair.slice(start + 1)}`;
    });
    expect(tampered).not.toEqual(cookies);
    const response = await runCallback(`code=abc&state=${state}`, tampered);
    await expectSignInRefused(response);
  });

  it("refuses a state cookie that stores a different state than its name", async () => {
    const { state, cookies } = await startLogin("/help");
    const mismatched = await stateCookie(state, {
      state: OTHER_STATE,
      codeVerifier: "v".repeat(43),
    });
    const response = await runCallback(`code=abc&state=${state}`, [
      ...cookies.filter(pair => !pair.startsWith(`${STATE_COOKIE_PREFIX}:`)),
      mismatched,
    ]);
    await expectSignInRefused(response);
  });

  it("clears this sign-in's state cookie", async () => {
    const { state, cookies } = await startLogin("/help");
    const response = await runCallback(`code=abc&state=${state}`, cookies);
    expect(await sessionTokensFrom(response)).toBeDefined();
    const [cleared, ...others] = stateCookiesSet(response);
    expect(others).toEqual([]);
    expect(cleared).toMatch(new RegExp(`^${STATE_COOKIE_PREFIX}:${state}=;`));
    expect(cleared).toContain("Max-Age=0");
    expect(cleared?.split("; ")).toEqual(
      expect.arrayContaining(["HttpOnly", "Secure", "SameSite=Lax", "Path=/"])
    );
  });
});

describe("/auth/callback code exchange", () => {
  it("sends the code with this sign-in's PKCE verifier and the client's HTTP Basic credentials", async () => {
    const { state, cookies } = await startLogin("/help");
    await runCallback(`code=abc&state=${state}`, cookies);

    const [exchange, ...others] = tokenRequests;
    expect(others).toEqual([]);
    // RFC 6749 §2.3.1: each credential form-encoded, then Base64.
    const [scheme, credentials = ""] =
      exchange?.authorization?.split(" ") ?? [];
    expect(scheme).toBe("Basic");
    expect(atob(credentials).split(":").map(decodeURIComponent)).toEqual([
      "client-id",
      "client-secret",
    ]);
    expect(exchange?.form.get("grant_type")).toBe("authorization_code");
    expect(exchange?.form.get("code_verifier")).toMatch(/^[\w-]{43,128}$/);
    expect(exchange?.form.has("client_secret")).toBe(false);
  });

  it("sends the redirect_uri the authorize request sent", async () => {
    const { state, cookies, redirectUri } = await startLogin("/help");
    await runCallback(`code=abc&state=${state}`, cookies);
    expect(redirectUri).toBe("https://app.test/auth/callback");
    expect(tokenRequests[0]?.form.get("redirect_uri")).toBe(redirectUri);
  });

  it("sends the configured redirect_uri when the callback arrives on another host", async () => {
    const env = { AUTH0_DEFAULT_REDIRECT_URI: "http://localhost:5173" };
    const { state, cookies, redirectUri } = await startLogin("/help", {
      origin: "http://127.0.0.1:5173",
      env,
    });
    const response = await runCallback(`code=abc&state=${state}`, cookies, {
      origin: "http://127.0.0.1:5173",
      env,
    });
    expect(await sessionTokensFrom(response)).toBeDefined();
    expect(redirectUri).toBe("http://localhost:5173/auth/callback");
    expect(tokenRequests[0]?.form.get("redirect_uri")).toBe(redirectUri);
  });

  it("bounds the code exchange by AUTH0_TIMEOUT_MS (5 s)", async () => {
    const { state, cookies } = await startLogin("/help");
    const asked = vi.spyOn(AbortSignal, "timeout");
    const response = await runCallback(`code=abc&state=${state}`, cookies);
    expect(await sessionTokensFrom(response)).toBeDefined();
    expect(asked.mock.calls).toEqual([[5_000]]);
  });

  /**
   * Signs in with Auth0 answering the code exchange with `token`, and
   * returns the response and the error the callback logged.
   */
  async function signInWithIdToken(token: string) {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    auth0TokenEndpoint(async () =>
      HttpResponse.json({
        access_token: "access-42",
        id_token: token,
        token_type: "Bearer",
      })
    );
    const { state, cookies } = await startLogin("/help");
    const response = await runCallback(`code=abc&state=${state}`, cookies);
    expect(exchangedCodes).toEqual(["abc"]);
    expect(response.headers.get("Location")).toBe("/help");
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]?.[0]).toBe("Authentication callback error:");
    return { response, logged: error.mock.calls[0]?.[1] };
  }

  /** openid-client's refusal of an ID token, for the reason `code` names. */
  const refusal = (code: string, detail: Readonly<Record<string, unknown>>) =>
    expect.objectContaining({
      code,
      cause: expect.objectContaining({
        code,
        cause: expect.objectContaining(detail),
      }),
    });

  it("refuses an HS256 ID token, even one signed with the client secret", async () => {
    const { response, logged } = await signInWithIdToken(
      await idToken({ algorithm: "HS256" })
    );
    expect(await sessionTokensFrom(response)).toBeUndefined();
    expect(logged).toEqual(
      refusal("OAUTH_INVALID_RESPONSE", {
        header: expect.objectContaining({ alg: "HS256" }),
        expected: "RS256",
      })
    );
  });

  it("refuses an ID token issued for another client", async () => {
    const { response, logged } = await signInWithIdToken(
      await idToken({ claims: { aud: "another-client" } })
    );
    expect(await sessionTokensFrom(response)).toBeUndefined();
    expect(logged).toEqual(
      refusal("OAUTH_JWT_CLAIM_COMPARISON_FAILED", {
        claim: "aud",
        expected: testEnv().AUTH0_CLIENT_ID,
      })
    );
  });

  it("refuses an ID token from another issuer", async () => {
    const { response, logged } = await signInWithIdToken(
      await idToken({ claims: { iss: "https://evil.example/" } })
    );
    expect(await sessionTokensFrom(response)).toBeUndefined();
    expect(logged).toEqual(
      refusal("OAUTH_JWT_CLAIM_COMPARISON_FAILED", {
        claim: "iss",
        expected: `https://${testEnv().AUTH0_DOMAIN}/`,
      })
    );
  });

  it("refuses an ID token that expired more than the 30 s clock tolerance ago", async () => {
    const { response, logged } = await signInWithIdToken(
      await idToken({ claims: { exp: Math.floor(Date.now() / 1000) - 31 } })
    );
    expect(await sessionTokensFrom(response)).toBeUndefined();
    expect(logged).toEqual(
      refusal("OAUTH_JWT_TIMESTAMP_CHECK_FAILED", {
        claim: "exp",
        tolerance: 30,
      })
    );
  });
});
