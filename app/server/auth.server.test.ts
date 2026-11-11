import { http, HttpResponse } from "msw/http";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
} from "vitest";
import { TOKEN_REFRESH_THRESHOLD_MS } from "~/constants/auth";
import {
  loadContext,
  sessionCookie,
  sessionTokens,
  testEnv,
} from "~/test/context";
import {
  AUTH0_REVOKE_ENDPOINT,
  AUTH0_TOKEN_ENDPOINT,
  idToken,
} from "~/test/auth0-fixture";
import { contractResponse } from "~/test/contract";
import { serveMocks } from "~/test/msw";
import {
  createAuthenticatedFetch,
  getServerAuthContext,
  revokeRefreshToken,
} from "./auth.server";
import { createSessionStorage, type SessionTokens } from "./session.server";

const env = testEnv();

const NOW = 1_700_000_000_000;
const { server } = serveMocks();

/** Refresh grants the fake Auth0 token endpoint received. */
const grants: URLSearchParams[] = [];

/** Answer refresh grants with `respond` (Auth0's real response shapes). */
function auth0Answers(respond: () => Response | Promise<Response>) {
  server.use(
    http.post(AUTH0_TOKEN_ENDPOINT, async ({ request }) => {
      grants.push(new URLSearchParams(await request.text()));
      return respond();
    })
  );
}

/** Auth0's answer to a refresh, with a fresh RS256 ID token (scope openid). */
async function auth0Tokens(body: Readonly<Record<string, unknown>>) {
  return HttpResponse.json({ id_token: await idToken(), ...body });
}

/** Auth0's OAuth error answer (`{ error, error_description }`). */
function auth0Error(body: Readonly<Record<string, string>>, status: number) {
  return HttpResponse.json(body, { status });
}

function tokens(overrides: Partial<SessionTokens> = {}): SessionTokens {
  return sessionTokens({
    accessToken: "old-access",
    refreshToken: "old-refresh",
    expiresAt: NOW + 60 * 60 * 1000,
    ...overrides,
  });
}

async function requestFor(stored?: SessionTokens) {
  const cookie = stored ? await sessionCookie(stored) : "";
  return new Request("https://app.test/", { headers: { Cookie: cookie } });
}

async function storedTokens(result: { headers?: Headers }) {
  const setCookie = result.headers?.get("Set-Cookie") ?? "";
  const session = await createSessionStorage(
    env.AUTH_SESSION_SECRET
  ).getSession(setCookie.split(";")[0]);
  return session.get("tokens");
}

const SIGNED_OUT = { isAuthenticated: false };

describe("getServerAuthContext", () => {
  let consoleError: MockInstance;
  let consoleWarn: MockInstance;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    grants.length = 0;
    consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("is unauthenticated without a session", async () => {
    const result = await getServerAuthContext(
      await requestFor(),
      loadContext()
    );
    expect(result.authContext).toEqual(SIGNED_OUT);
    expect(result.headers).toBeUndefined();
    expect(grants).toEqual([]);
  });

  it("does not refresh a fresh token", async () => {
    const result = await getServerAuthContext(
      await requestFor(tokens()),
      loadContext()
    );
    expect(grants).toEqual([]);
    expect(result.authContext).toEqual({
      isAuthenticated: true,
      accessToken: "old-access",
    });
    expect(result.headers).toBeUndefined();
  });

  it("refreshes a token within the threshold and re-issues the cookie", async () => {
    auth0Answers(() =>
      auth0Tokens({
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_in: 3600,
        token_type: "Bearer",
      })
    );
    const expiresAt = NOW + TOKEN_REFRESH_THRESHOLD_MS - 1;

    const result = await getServerAuthContext(
      await requestFor(tokens({ expiresAt })),
      loadContext()
    );

    expect(grants).toHaveLength(1);
    expect(grants[0]?.get("grant_type")).toBe("refresh_token");
    expect(grants[0]?.get("refresh_token")).toBe("old-refresh");
    expect(result.authContext).toEqual({
      isAuthenticated: true,
      accessToken: "new-access",
    });
    expect(await storedTokens(result)).toEqual({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      expiresAt: NOW + 3600 * 1000,
    });
  });

  it.each([
    ["a 401 and an empty body", () => new HttpResponse(null, { status: 401 })],
    [
      "a 403 and invalid_grant",
      () =>
        auth0Error(
          {
            error: "invalid_grant",
            error_description: "Unknown or invalid refresh token.",
          },
          403
        ),
    ],
  ])(
    "clears the session when Auth0 refuses the refresh token with %s",
    async (_case, respond) => {
      auth0Answers(respond);
      const result = await getServerAuthContext(
        await requestFor(tokens({ expiresAt: NOW + 1000 })),
        loadContext()
      );
      expect(result.authContext).toEqual(SIGNED_OUT);
      expect(result.headers?.get("Set-Cookie")).toMatch(
        /^__Host-bt_session=;.*Expires=Thu, 01 Jan 1970/
      );
      expect(consoleWarn).toHaveBeenCalledWith(
        "Auth0 refused the refresh token:",
        expect.any(Error)
      );
      expect(consoleError).not.toHaveBeenCalled();
    }
  );

  it.each([
    [
      "a 500 and an OAuth error",
      () => auth0Error({ error: "server_error" }, 500),
    ],
    ["a network failure", () => HttpResponse.error()],
    ["a malformed body", () => new HttpResponse("<html>", { status: 200 })],
  ])(
    "keeps the session and its still-valid token when Auth0 answers with %s",
    async (_case, respond) => {
      auth0Answers(respond);
      const result = await getServerAuthContext(
        await requestFor(tokens({ expiresAt: NOW + 60_000 })),
        loadContext()
      );
      expect(result.authContext).toEqual({
        isAuthenticated: true,
        accessToken: "old-access",
      });
      expect(result.headers).toBeUndefined();
      expect(consoleError).toHaveBeenCalled();
    }
  );

  it("signs out this request but keeps the cookie when the token has expired and Auth0 is down", async () => {
    auth0Answers(() => new HttpResponse(null, { status: 502 }));
    const result = await getServerAuthContext(
      await requestFor(tokens({ expiresAt: NOW - 1 })),
      loadContext()
    );
    expect(result.authContext).toEqual(SIGNED_OUT);
    expect(result.headers).toBeUndefined();
  });

  it("refreshes with the client's HTTP Basic credentials", async () => {
    const seen: Array<string | null> = [];
    server.use(
      http.post(AUTH0_TOKEN_ENDPOINT, async ({ request }) => {
        seen.push(request.headers.get("Authorization"));
        grants.push(new URLSearchParams(await request.text()));
        return auth0Tokens({
          access_token: "new-access",
          token_type: "Bearer",
        });
      })
    );
    await getServerAuthContext(
      await requestFor(tokens({ expiresAt: NOW })),
      loadContext()
    );
    // RFC 6749 §2.3.1: each credential form-encoded, then Base64.
    const [scheme, credentials = ""] = seen[0]?.split(" ") ?? [];
    expect(seen).toHaveLength(1);
    expect(scheme).toBe("Basic");
    expect(atob(credentials).split(":").map(decodeURIComponent)).toEqual([
      "client-id",
      "client-secret",
    ]);
    expect(grants[0]?.has("client_secret")).toBe(false);
  });

  it("shares one refresh across parallel calls in a request", async () => {
    auth0Answers(() =>
      auth0Tokens({ access_token: "new-access", token_type: "Bearer" })
    );
    const request = await requestFor(tokens({ expiresAt: NOW }));
    const context = loadContext();

    const [first, second, third] = await Promise.all([
      getServerAuthContext(request, context),
      getServerAuthContext(request, context),
      getServerAuthContext(request, context),
    ]);

    expect(grants).toHaveLength(1);
    expect(second).toBe(first);
    expect(third).toBe(first);
  });
});

describe("createAuthenticatedFetch", () => {
  const ME = {
    id: "google-oauth2|1",
    display_name: "Morwen",
    role: "contributor",
  };

  it("sends the session's token with the auth0| prefix", async () => {
    const seen: Array<string | null> = [];
    server.use(
      http.get("https://api.test/v1/me", ({ request }) => {
        seen.push(request.headers.get("Authorization"));
        return contractResponse("getMe", 200, ME);
      })
    );
    const auth = await createAuthenticatedFetch(
      await requestFor(sessionTokens({ accessToken: "abc" })),
      loadContext()
    );
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.headers).toBeUndefined();
    await auth.authFetch("https://api.test/v1/me");
    expect(seen).toEqual(["Bearer auth0|abc"]);
  });
});

describe("revokeRefreshToken", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("revokes the token at Auth0", async () => {
    const revoked: URLSearchParams[] = [];
    server.use(
      http.post(AUTH0_REVOKE_ENDPOINT, async ({ request }) => {
        revoked.push(new URLSearchParams(await request.text()));
        return new HttpResponse(null, { status: 200 });
      })
    );
    await revokeRefreshToken("refresh-1", env);
    expect(revoked.map(form => form.get("token"))).toEqual(["refresh-1"]);
  });

  it("logs and carries on when Auth0 fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    server.use(
      http.post(
        AUTH0_REVOKE_ENDPOINT,
        () => new HttpResponse(null, { status: 503 })
      )
    );
    await expect(revokeRefreshToken("refresh-1", env)).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "Couldn’t revoke the refresh token at logout:",
      expect.anything()
    );
  });
});
