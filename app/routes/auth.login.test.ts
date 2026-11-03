import { createCookie } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getOrCreateSessionStorage } from "~/server/auth.server";
import type { AppEnv } from "~/server/env.server";
import { createReturnToCookie } from "~/server/return-to.server";
import { loadContext, routeArgs, testEnv } from "~/test/context";
import { loader } from "./auth.login";

const SECRET = testEnv().AUTH_SESSION_SECRET;
/** Each sign-in's state cookie is named `${STATE_COOKIE_PREFIX}:<state>`. */
const STATE_COOKIE_PREFIX = "__Host-bt_auth0";

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

  it("asks for a code, an access token for the API and a refresh token, and nothing else", async () => {
    const location = expectAuth0Redirect(
      await login("https://app.test/auth/login")
    );
    expect([...location.searchParams.keys()].sort()).toEqual([
      "audience",
      "client_id",
      "code_challenge",
      "code_challenge_method",
      "redirect_uri",
      "response_type",
      "scope",
      "state",
    ]);
    expect(location.searchParams.get("response_type")).toBe("code");
    expect(location.searchParams.get("scope")).toBe("openid offline_access");
  });

  it("keeps the state and PKCE verifier in a signed cookie named for that state, for 5 minutes", async () => {
    const response = await login("https://app.test/auth/login");
    const location = expectAuth0Redirect(response);
    const state = location.searchParams.get("state") ?? "";
    expect(state).toMatch(/^[\w-]{43}$/);

    const [stateCookie, ...others] = setCookies(response).filter(value =>
      value.startsWith(`${STATE_COOKIE_PREFIX}:`)
    );
    expect(others).toEqual([]);
    expect(stateCookie?.split("=")[0]).toBe(`${STATE_COOKIE_PREFIX}:${state}`);
    expect(stateCookie).toContain("Max-Age=300");

    const stored: unknown = await createCookie(
      `${STATE_COOKIE_PREFIX}:${state}`,
      { secrets: [SECRET] }
    ).parse(stateCookie?.split(";")[0] ?? "");
    expect(stored).toEqual({ state, codeVerifier: expect.any(String) });
    const { codeVerifier } = stored as { readonly codeVerifier: string };
    expect(codeVerifier).toMatch(/^[\w-]{43,128}$/);
    // S256: the challenge is the verifier's SHA-256, base64url-encoded.
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(codeVerifier)
    );
    expect(location.searchParams.get("code_challenge")).toBe(
      Buffer.from(digest).toString("base64url")
    );
    // A signature from another secret doesn't parse.
    expect(
      await createCookie(`${STATE_COOKIE_PREFIX}:${state}`, {
        secrets: ["another-secret-of-at-least-32-chars"],
      }).parse(stateCookie?.split(";")[0] ?? "")
    ).toBeNull();
  });

  it("starts a separate sign-in each time, so two tabs don't share a state", async () => {
    const first = expectAuth0Redirect(
      await login("https://app.test/auth/login")
    );
    const second = expectAuth0Redirect(
      await login("https://app.test/auth/login")
    );
    expect(first.searchParams.get("state")).not.toBe(
      second.searchParams.get("state")
    );
    expect(first.searchParams.get("code_challenge")).not.toBe(
      second.searchParams.get("code_challenge")
    );
  });

  it("stores the state in a __Host- cookie that is HttpOnly, Secure and Lax", async () => {
    const response = await login("https://app.test/auth/login");
    const state = setCookies(response).find(value =>
      value.startsWith("__Host-bt_auth0:")
    );
    const attributes = state?.split("; ").slice(1) ?? [];
    expect(attributes).toEqual(
      expect.arrayContaining(["HttpOnly", "Secure", "SameSite=Lax", "Path=/"])
    );
    expect(attributes.some(attribute => /^Domain=/i.test(attribute))).toBe(
      false
    );
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

  it("never forwards returnTo, state or code to Auth0", async () => {
    const location = expectAuth0Redirect(
      await login(
        "https://app.test/auth/login?returnTo=/help&state=forged&code=forged"
      )
    );
    expect(location.searchParams.get("state")).not.toBe("forged");
    expect(location.searchParams.has("code")).toBe(false);
    expect(location.searchParams.has("returnTo")).toBe(false);
  });
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

  it("shows the fixture-user chooser without ?as", async () => {
    vi.stubGlobal("__STUB_AUTH__", true);
    const response = await login(
      "http://localhost:8788/auth/login?returnTo=/settings",
      { AUTH_MODE: "stub" }
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain(
      "/auth/login?as=moderator&amp;returnTo=%2Fsettings"
    );
    expect(setCookies(response)).toEqual([]);
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

  it("uses Auth0 when AUTH_MODE is not stub", async () => {
    vi.stubGlobal("__STUB_AUTH__", true);
    expectAuth0Redirect(
      await login("http://127.0.0.1:8788/auth/login?as=moderator")
    );
  });

  it("uses Auth0, logging an error, for a non-local host", async () => {
    vi.stubGlobal("__STUB_AUTH__", true);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    expectAuth0Redirect(
      await login("https://bardictorch.org/auth/login?as=moderator", {
        AUTH_MODE: "stub",
      })
    );
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("AUTH_MODE=stub ignored")
    );
  });
});
