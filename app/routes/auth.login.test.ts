import { afterEach, describe, expect, it, vi } from "vitest";
import { getOrCreateSessionStorage } from "~/server/auth.server";
import type { AppEnv } from "~/server/env.server";
import { createReturnToCookie } from "~/server/return-to.server";
import { loadContext, routeArgs, testEnv } from "~/test/context";
import { loader } from "./auth.login";

const SECRET = testEnv().AUTH_SESSION_SECRET;

function login(url: string, env: Partial<AppEnv> = {}) {
  return loader(routeArgs(new Request(url), { context: loadContext(env) }));
}

function setCookies(response: Response): string[] {
  return response.headers.getSetCookie();
}

async function returnToFrom(response: Response) {
  const cookie = setCookies(response).find(value =>
    value.startsWith("__Host-bt_return_to=")
  );
  return createReturnToCookie(SECRET).parse(cookie?.split(";")[0] ?? "");
}

function expectAuth0Redirect(response: Response) {
  expect(response.status).toBe(302);
  const location = new URL(response.headers.get("Location") ?? "");
  expect(`${location.origin}${location.pathname}`).toBe(
    "https://auth0.test/authorize"
  );
  return location;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("/auth/login with Auth0", () => {
  it("redirects to Auth0 with state, PKCE, audience and the callback URL", async () => {
    const location = expectAuth0Redirect(
      await login("https://app.test/auth/login")
    );
    expect(location.searchParams.get("client_id")).toBe("client-id");
    expect(location.searchParams.get("redirect_uri")).toBe(
      "https://app.test/auth/callback"
    );
    expect(location.searchParams.get("audience")).toBe("audience");
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("state")).toBeTruthy();
  });

  it("remembers a safe returnTo in the signed returnTo cookie", async () => {
    const response = await login(
      "https://app.test/auth/login?returnTo=%2Fhelp%3Ftab%3D1"
    );
    expect(await returnToFrom(response)).toBe("/help?tab=1");
  });

  it.each(["//evil.com", "https://evil.com", "/%2F%2Fevil.com"])(
    "remembers / instead of the unsafe returnTo %j",
    async returnTo => {
      const response = await login(
        `https://app.test/auth/login?returnTo=${encodeURIComponent(returnTo)}`
      );
      expect(await returnToFrom(response)).toBe("/");
    }
  );
});

describe("/auth/login stub auth", () => {
  it("signs in the fixture user when the build flag, AUTH_MODE=stub and a local host all hold", async () => {
    vi.stubGlobal("__STUB_AUTH__", true);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await login(
      "http://127.0.0.1:8788/auth/login?as=moderator&returnTo=/help",
      { AUTH_MODE: "stub" }
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/help");
    const session = await getOrCreateSessionStorage({
      AUTH_SESSION_SECRET: SECRET,
    }).getSession(response.headers.get("Set-Cookie")?.split(";")[0]);
    expect(session.get("tokens")?.accessToken).toBe("fixture:moderator");
  });

  it("uses Auth0 when the build lacks stub auth, logging an error", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const response = await login(
      "http://127.0.0.1:8788/auth/login?as=moderator",
      {
        AUTH_MODE: "stub",
      }
    );

    expectAuth0Redirect(response);
    expect(
      setCookies(response).some(value => value.includes("bt_session"))
    ).toBe(false);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("AUTH_MODE=stub ignored")
    );
  });
});
