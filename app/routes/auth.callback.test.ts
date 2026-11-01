import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Auth0Strategy } from "remix-auth-auth0";
import {
  AUTH0_TIMEOUT_MS,
  DEFAULT_TOKEN_EXPIRY_SECONDS,
} from "~/constants/auth";
import { getOrCreateSessionStorage } from "~/server/auth.server";
import { createReturnToCookie } from "~/server/return-to.server";
import { loadContext } from "~/test/context";
import { loader as callback } from "./auth.callback";
import { loader as login } from "./auth.login";
import { serveMocks } from "~/test/msw";

const SECRET = loadContext().cloudflare.env.AUTH_SESSION_SECRET;

const ID_TOKEN = "header.payload.signature";

/** Codes the fake Auth0 token endpoint received. */
const exchangedCodes: string[] = [];
const { server } = serveMocks();

function auth0TokenEndpoint(respond: () => Response) {
  server.use(
    http.post("https://auth0.test/oauth/token", async ({ request }) => {
      const form = new URLSearchParams(await request.text());
      exchangedCodes.push(form.get("code") ?? "");
      return respond();
    })
  );
}

beforeEach(() => {
  auth0TokenEndpoint(() =>
    HttpResponse.json({
      access_token: "access-42",
      id_token: ID_TOKEN,
      refresh_token: "refresh-42",
      expires_in: 3600,
      token_type: "Bearer",
    })
  );
});
afterEach(() => {
  exchangedCodes.length = 0;
  vi.restoreAllMocks();
});

function cookiePairs(response: Response): string[] {
  return response.headers
    .getSetCookie()
    .map(value => value.split(";")[0] ?? "");
}

/** Start a login and return what the browser brings back to the callback. */
async function startLogin(returnTo?: string) {
  const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
  const response = await login({
    request: new Request(`https://app.test/auth/login${query}`),
    params: {},
    context: loadContext(),
  });
  const state = new URL(
    response.headers.get("Location") ?? ""
  ).searchParams.get("state");
  return { state: state ?? "", cookies: cookiePairs(response) };
}

function runCallback(query: string, cookies: readonly string[]) {
  return callback({
    request: new Request(`https://app.test/auth/callback?${query}`, {
      headers: { Cookie: cookies.join("; ") },
    }),
    params: {},
    context: loadContext(),
  });
}

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
      HttpResponse.json({ access_token: "access-42", token_type: "Bearer" })
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
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { state, cookies } = await startLogin("/help");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const authenticate = vi
        .spyOn(Auth0Strategy.prototype, "authenticate")
        .mockReturnValue(new Promise(() => undefined));
      const pending = runCallback(`code=abc&state=${state}`, cookies);
      while (authenticate.mock.calls.length === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
      await vi.advanceTimersByTimeAsync(AUTH0_TIMEOUT_MS);
      const response = await pending;
      expect(response.headers.get("Location")).toBe("/help");
      expect(await sessionTokensFrom(response)).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
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
    ["a state that doesn't match the cookie", "code=abc&state=forged"],
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
