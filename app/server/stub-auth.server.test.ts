import { afterEach, describe, expect, it, vi } from "vitest";
import { getOrCreateSessionStorage } from "./auth.server";
import { loadContext } from "~/test/context";
import { stubLogin } from "./stub-auth.server";

const stubEnv = loadContext({ AUTH_MODE: "stub" }).cloudflare.env;

async function sessionUserFrom(response: Response) {
  const setCookie = response.headers.get("Set-Cookie") ?? "";
  const session = await getOrCreateSessionStorage(stubEnv).getSession(
    setCookie.split(";")[0]
  );
  return session.get("user");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("stubLogin", () => {
  it.each(["http://localhost:5173", "http://127.0.0.1:8788"])(
    "signs in the seeded contributor by default on %s",
    async origin => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const response = await stubLogin(
        new Request(`${origin}/auth/login`),
        stubEnv
      );

      expect(response?.status).toBe(302);
      expect(response?.headers.get("Location")).toBe("/");
      expect(await sessionUserFrom(response as Response)).toMatchObject({
        id: "fixture|contributor",
        accessToken: "fixture:contributor",
      });
    }
  );

  it("signs in the fixture user named by ?as and honours a safe returnTo", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await stubLogin(
      new Request("http://localhost/auth/login?as=user-7&returnTo=/help"),
      stubEnv
    );

    expect(response?.headers.get("Location")).toBe("/help");
    const user = await sessionUserFrom(response as Response);
    expect(user?.accessToken).toBe("fixture:user-7");
    expect(user?.expiresAt).toBeGreaterThan(Date.now() + 60 * 60 * 1000);
  });

  it("sends an unsafe returnTo home", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await stubLogin(
      new Request("http://localhost/auth/login?returnTo=//evil.com"),
      stubEnv
    );
    expect(response?.headers.get("Location")).toBe("/");
  });

  it("sets the real session cookie", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await stubLogin(
      new Request("http://localhost/auth/login"),
      stubEnv
    );
    const setCookie = response?.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toMatch(/^__Host-bt_session=[^;]+;/);
    expect(setCookie.split("; ")).toEqual(
      expect.arrayContaining(["HttpOnly", "Secure", "SameSite=Lax", "Path=/"])
    );
  });

  it.each(["", "Contributor", "../admin", "a b", "x".repeat(65)])(
    "rejects the fixture user id %j",
    async id => {
      const response = await stubLogin(
        new Request(`http://localhost/auth/login?as=${encodeURIComponent(id)}`),
        stubEnv
      );
      expect(response?.status).toBe(400);
      expect(response?.headers.get("Set-Cookie")).toBeNull();
    }
  );

  it("does nothing unless AUTH_MODE=stub", async () => {
    const env = loadContext({ AUTH_MODE: "auth0" }).cloudflare.env;
    expect(
      await stubLogin(new Request("http://localhost/auth/login"), env)
    ).toBeNull();
  });

  it.each([
    "https://bardictorch.org",
    "https://preview.bardic-torch-fe.pages.dev",
    "http://localhost.evil.example",
    "http://127.0.0.2",
    "http://[::1]",
  ])("refuses, with an error log, for the host of %s", async origin => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    expect(
      await stubLogin(new Request(`${origin}/auth/login?as=moderator`), stubEnv)
    ).toBeNull();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("AUTH_MODE=stub ignored")
    );
  });
});
