import { http, HttpResponse } from "msw";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
} from "vitest";
import { Auth0Strategy } from "remix-auth-auth0";
import {
  AUTH0_TIMEOUT_MS,
  DEFAULT_TOKEN_EXPIRY_SECONDS,
  TOKEN_REFRESH_THRESHOLD_MS,
} from "~/constants/auth";
import { loadContext, sessionCookie, sessionTokens } from "~/test/context";
import { serveMocks } from "~/test/msw";
import {
  createAuthenticatedFetch,
  getServerAuthContext,
  revokeRefreshToken,
} from "./auth.server";
import { createSessionStorage, type SessionTokens } from "./session.server";

const env = loadContext().cloudflare.env;
const TOKEN_ENDPOINT = "https://auth0.test/oauth/token";
const REVOKE_ENDPOINT = "https://auth0.test/oauth/revoke";

const NOW = 1_700_000_000_000;
const { server } = serveMocks();

/** Refresh grants the fake Auth0 token endpoint received. */
const grants: URLSearchParams[] = [];

/** Answer refresh grants with `respond` (Auth0's real response shapes). */
function auth0Answers(respond: () => Response) {
  server.use(
    http.post(TOKEN_ENDPOINT, async ({ request }) => {
      grants.push(new URLSearchParams(await request.text()));
      return respond();
    })
  );
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

/** Let real I/O (the session's signature check) run until `spy` is called. */
async function untilCalled(spy: MockInstance) {
  while (spy.mock.calls.length === 0) {
    await new Promise(resolve => setImmediate(resolve));
  }
}

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

  it("does not refresh just outside the threshold", async () => {
    const expiresAt = NOW + TOKEN_REFRESH_THRESHOLD_MS + 1;
    await getServerAuthContext(
      await requestFor(tokens({ expiresAt })),
      loadContext()
    );
    expect(grants).toEqual([]);
  });

  it("refreshes a token within the threshold and re-issues the cookie", async () => {
    auth0Answers(() =>
      HttpResponse.json({
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

  it("refreshes an already expired token", async () => {
    auth0Answers(() =>
      HttpResponse.json({
        access_token: "new-access",
        expires_in: 60,
        token_type: "Bearer",
      })
    );
    const result = await getServerAuthContext(
      await requestFor(tokens({ expiresAt: NOW - 1000 })),
      loadContext()
    );
    expect(result.authContext).toEqual({
      isAuthenticated: true,
      accessToken: "new-access",
    });
  });

  it("keeps the old refresh token and assumes the default lifetime when Auth0 sends neither", async () => {
    // Refresh-token rotation off: Auth0 answers with an access token only.
    auth0Answers(() =>
      HttpResponse.json({ access_token: "new-access", token_type: "Bearer" })
    );
    const result = await getServerAuthContext(
      await requestFor(tokens({ expiresAt: NOW })),
      loadContext()
    );
    expect(result.authContext.isAuthenticated).toBe(true);
    expect(await storedTokens(result)).toEqual({
      accessToken: "new-access",
      refreshToken: "old-refresh",
      expiresAt: NOW + DEFAULT_TOKEN_EXPIRY_SECONDS * 1000,
    });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it.each([400, 401, 403])(
    "clears the session when Auth0 refuses the refresh token with a %i",
    async status => {
      // arctic parses the OAuth error of a 400 or 401 and discards any
      // other body (a body it has to cancel stalls under msw, so a 403
      // comes without one here).
      auth0Answers(() =>
        status === 403
          ? new HttpResponse(null, { status })
          : HttpResponse.json(
              {
                error: "invalid_grant",
                error_description: "Unknown or invalid refresh token.",
              },
              { status }
            )
      );
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
    }
  );

  it.each([
    ["a 503", () => new HttpResponse(null, { status: 503 })],
    ["a 429", () => new HttpResponse(null, { status: 429 })],
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

  it("gives up on a hanging Auth0 after the timeout and keeps the session", async () => {
    const request = await requestFor(tokens({ expiresAt: NOW + 60_000 }));
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(NOW);
    const refresh = vi
      .spyOn(Auth0Strategy.prototype, "refreshToken")
      .mockReturnValue(new Promise(() => undefined));
    const pending = getServerAuthContext(request, loadContext());
    await untilCalled(refresh);
    await vi.advanceTimersByTimeAsync(AUTH0_TIMEOUT_MS);
    const result = await pending;
    expect(result.authContext).toEqual({
      isAuthenticated: true,
      accessToken: "old-access",
    });
    expect(result.headers).toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "Couldn’t refresh the access token:",
      expect.objectContaining({ message: "Auth0 token refresh timed out" })
    );
  });

  it("uses a token without a refresh token until it expires, then ends the session", async () => {
    const { refreshToken: _omitted, ...withoutRefresh } = tokens();

    const valid = await getServerAuthContext(
      await requestFor({ ...withoutRefresh, expiresAt: NOW + 1000 }),
      loadContext()
    );
    expect(valid.authContext.isAuthenticated).toBe(true);
    expect(valid.headers).toBeUndefined();

    const expired = await getServerAuthContext(
      await requestFor({ ...withoutRefresh, expiresAt: NOW }),
      loadContext()
    );
    expect(grants).toEqual([]);
    expect(expired.authContext).toEqual(SIGNED_OUT);
    expect(expired.headers?.get("Set-Cookie")).toMatch(/^__Host-bt_session=;/);
  });

  it("shares one refresh across parallel calls in a request", async () => {
    auth0Answers(() =>
      HttpResponse.json({ access_token: "new-access", token_type: "Bearer" })
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

  it("does not share results between requests", async () => {
    auth0Answers(() =>
      HttpResponse.json({ access_token: "new-access", token_type: "Bearer" })
    );
    const request = await requestFor(tokens({ expiresAt: NOW }));

    await getServerAuthContext(request, loadContext());
    await getServerAuthContext(request, loadContext());

    expect(grants).toHaveLength(2);
  });
});

describe("createAuthenticatedFetch", () => {
  it("sends the session's token with the auth0| prefix", async () => {
    const seen: Array<string | null> = [];
    server.use(
      http.get("https://api.test/v1/me", ({ request }) => {
        seen.push(request.headers.get("Authorization"));
        return HttpResponse.json({});
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

  it("sends no Authorization signed out", async () => {
    const seen: Array<string | null> = [];
    server.use(
      http.get("https://api.test/v1/me", ({ request }) => {
        seen.push(request.headers.get("Authorization"));
        return HttpResponse.json({});
      })
    );
    const auth = await createAuthenticatedFetch(
      await requestFor(),
      loadContext()
    );
    expect(auth.isAuthenticated).toBe(false);
    await auth.authFetch("https://api.test/v1/me", {
      headers: { Authorization: "Bearer forged" },
    });
    expect(seen).toEqual(["Bearer forged"]);
  });
});

describe("revokeRefreshToken", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("revokes the token at Auth0", async () => {
    const revoked: URLSearchParams[] = [];
    server.use(
      http.post(REVOKE_ENDPOINT, async ({ request }) => {
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
      http.post(REVOKE_ENDPOINT, () => new HttpResponse(null, { status: 503 }))
    );
    await expect(revokeRefreshToken("refresh-1", env)).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "Couldn’t revoke the refresh token at logout:",
      expect.anything()
    );
  });

  it("gives up after the timeout", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(Auth0Strategy.prototype, "revokeToken").mockReturnValue(
      new Promise(() => undefined)
    );
    const pending = revokeRefreshToken("refresh-1", env);
    await vi.advanceTimersByTimeAsync(AUTH0_TIMEOUT_MS);
    await expect(pending).resolves.toBeUndefined();
  });
});
