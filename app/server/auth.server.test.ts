import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AppLoadContext } from "@remix-run/cloudflare";
import { Auth0Strategy } from "remix-auth-auth0";
import {
  DEFAULT_TOKEN_EXPIRY_SECONDS,
  TOKEN_REFRESH_THRESHOLD_MS,
} from "~/constants/auth";
import { getServerAuthContext } from "./auth.server";
import { createSessionStorage, type SessionData } from "./session.server";

const env = {
  BARDIC_TORCH_API_BASE_URL: "https://api.test",
  AUTH_SESSION_SECRET: "a-test-secret-of-at-least-32-characters",
  AUTH0_DOMAIN: "auth0.test",
  AUTH0_CLIENT_ID: "client-id",
  AUTH0_CLIENT_SECRET: "client-secret",
  AUTH0_DEFAULT_REDIRECT_URI: "https://app.test",
  AUTH0_AUDIENCE: "audience",
};

const NOW = 1_700_000_000_000;

type RefreshedTokens = {
  accessToken: () => string;
  refreshToken: () => string | null;
  accessTokenExpiresInSeconds: () => number | null;
};

function tokens(overrides: Partial<RefreshedTokens> = {}): RefreshedTokens {
  return {
    accessToken: () => "new-access",
    refreshToken: () => "new-refresh",
    accessTokenExpiresInSeconds: () => 3600,
    ...overrides,
  };
}

function user(overrides: Partial<SessionData["user"]> = {}) {
  return {
    id: "auth0|1",
    email: "bard@example.test",
    accessToken: "old-access",
    refreshToken: "old-refresh",
    expiresAt: NOW + 60 * 60 * 1000,
    ...overrides,
  } satisfies SessionData["user"];
}

async function requestFor(sessionUser?: SessionData["user"]) {
  const storage = createSessionStorage(env.AUTH_SESSION_SECRET);
  const session = await storage.getSession();
  if (sessionUser) session.set("user", sessionUser);
  const cookie = (await storage.commitSession(session)).split(";")[0] ?? "";
  return new Request("https://app.test/", { headers: { Cookie: cookie } });
}

function loadContext(): AppLoadContext {
  return { cloudflare: { env }, authCache: {} } as unknown as AppLoadContext;
}

describe("getServerAuthContext", () => {
  const refreshToken = vi.spyOn(Auth0Strategy.prototype, "refreshToken");
  const consoleError = vi.spyOn(console, "error");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    refreshToken.mockReset();
    consoleError.mockReset().mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is unauthenticated without a session", async () => {
    const result = await getServerAuthContext(
      await requestFor(),
      loadContext()
    );
    expect(result.authContext).toEqual({
      isAuthenticated: false,
      accessToken: null,
      user: null,
    });
    expect(result.headers).toBeUndefined();
    expect(refreshToken).not.toHaveBeenCalled();
  });

  it("does not refresh a fresh token", async () => {
    const fresh = user();
    const result = await getServerAuthContext(
      await requestFor(fresh),
      loadContext()
    );
    expect(refreshToken).not.toHaveBeenCalled();
    expect(result.authContext).toEqual({
      isAuthenticated: true,
      accessToken: "old-access",
      user: fresh,
    });
    expect(result.headers).toBeUndefined();
  });

  it("does not refresh just outside the threshold", async () => {
    const expiresAt = NOW + TOKEN_REFRESH_THRESHOLD_MS + 1;
    await getServerAuthContext(
      await requestFor(user({ expiresAt })),
      loadContext()
    );
    expect(refreshToken).not.toHaveBeenCalled();
  });

  it("refreshes a token within the threshold and re-issues the cookie", async () => {
    refreshToken.mockResolvedValue(tokens() as never);
    const expiresAt = NOW + TOKEN_REFRESH_THRESHOLD_MS - 1;

    const result = await getServerAuthContext(
      await requestFor(user({ expiresAt })),
      loadContext()
    );

    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(refreshToken).toHaveBeenCalledWith("old-refresh");
    expect(result.authContext.isAuthenticated).toBe(true);
    expect(result.authContext.accessToken).toBe("new-access");
    expect(result.authContext.user).toMatchObject({
      id: "auth0|1",
      email: "bard@example.test",
      accessToken: "new-access",
      refreshToken: "new-refresh",
      expiresAt: NOW + 3600 * 1000,
    });

    const setCookie = result.headers?.get("Set-Cookie") ?? "";
    const stored = await createSessionStorage(
      env.AUTH_SESSION_SECRET
    ).getSession(setCookie.split(";")[0]);
    expect(stored.get("user")?.accessToken).toBe("new-access");
  });

  it("refreshes an already expired token", async () => {
    refreshToken.mockResolvedValue(tokens() as never);
    const result = await getServerAuthContext(
      await requestFor(user({ expiresAt: NOW - 1000 })),
      loadContext()
    );
    expect(result.authContext.accessToken).toBe("new-access");
  });

  it("keeps the old refresh token when Auth0 does not rotate it", async () => {
    refreshToken.mockResolvedValue(
      tokens({
        refreshToken: () => null,
        accessTokenExpiresInSeconds: () => null,
      }) as never
    );
    const result = await getServerAuthContext(
      await requestFor(user({ expiresAt: NOW })),
      loadContext()
    );
    expect(result.authContext.user?.refreshToken).toBe("old-refresh");
    expect(result.authContext.user?.expiresAt).toBe(
      NOW + DEFAULT_TOKEN_EXPIRY_SECONDS * 1000
    );
  });

  it("clears the session when the refresh fails", async () => {
    refreshToken.mockRejectedValue(new Error("invalid_grant"));
    const result = await getServerAuthContext(
      await requestFor(user({ expiresAt: NOW })),
      loadContext()
    );
    expect(result.authContext).toEqual({
      isAuthenticated: false,
      accessToken: null,
      user: null,
    });
    expect(result.headers?.get("Set-Cookie")).toMatch(
      /^__Host-bt_session=;.*Expires=Thu, 01 Jan 1970/
    );
    expect(consoleError).toHaveBeenCalled();
  });

  it("clears the session when an expiring token has no refresh token", async () => {
    const { refreshToken: _omitted, ...withoutRefresh } = user();
    const result = await getServerAuthContext(
      await requestFor({ ...withoutRefresh, expiresAt: NOW }),
      loadContext()
    );
    expect(refreshToken).not.toHaveBeenCalled();
    expect(result.authContext.isAuthenticated).toBe(false);
    expect(result.headers?.get("Set-Cookie")).toMatch(/^__Host-bt_session=;/);
  });

  it("shares one refresh across parallel calls in a request", async () => {
    refreshToken.mockResolvedValue(tokens() as never);
    const request = await requestFor(user({ expiresAt: NOW }));
    const context = loadContext();

    const [first, second, third] = await Promise.all([
      getServerAuthContext(request, context),
      getServerAuthContext(request, context),
      getServerAuthContext(request, context),
    ]);

    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it("does not share results between requests", async () => {
    refreshToken.mockResolvedValue(tokens() as never);
    const request = await requestFor(user({ expiresAt: NOW }));

    await getServerAuthContext(request, loadContext());
    await getServerAuthContext(request, loadContext());

    expect(refreshToken).toHaveBeenCalledTimes(2);
  });
});
