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
    "without ?as shows the fixture-user chooser on %s, signing nobody in",
    async origin => {
      const response = await stubLogin(
        new Request(`${origin}/auth/login?returnTo=%2Fsettings`),
        stubEnv
      );

      expect(response?.status).toBe(200);
      expect(response?.headers.get("Set-Cookie")).toBeNull();
      expect(response?.headers.get("Content-Type")).toBe(
        "text/html; charset=utf-8"
      );
      expect(response?.headers.get("Cache-Control")).toBe("no-store");
      const csp = response?.headers.get("Content-Security-Policy") ?? "";
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).not.toContain("unsafe-inline");

      const html = (await response?.text()) ?? "";
      expect(html).toContain('<html lang="en">');
      expect(html).toContain(
        "<title>Choose a fixture user · Bardic Torch</title>"
      );
      expect(html).toContain('<meta name="robots" content="noindex">');
      expect(html).toContain(
        '<a href="/auth/login?as=contributor&amp;returnTo=%2Fsettings">Log in as the seeded contributor'
      );
      expect(html).toContain(
        '<a href="/auth/login?as=moderator&amp;returnTo=%2Fsettings">Log in as the seeded moderator'
      );
      expect(html).toContain('<label for="fixture-user">');
      expect(html).toContain('pattern="[a-z0-9][a-z0-9\\-]{0,63}"');
      expect(html).toContain(
        '<input type="hidden" name="returnTo" value="/settings">'
      );
      expect(html).not.toMatch(/<script|style=/);
    }
  );

  it("the chooser carries only a safe returnTo, which can't break out of the markup", async () => {
    const unsafe = await stubLogin(
      new Request("http://localhost/auth/login?returnTo=//evil.com"),
      stubEnv
    );
    expect(await unsafe?.text()).toContain(
      '<input type="hidden" name="returnTo" value="/">'
    );

    const quoted = await stubLogin(
      new Request(
        `http://localhost/auth/login?returnTo=${encodeURIComponent('/help?q="><b>')}`
      ),
      stubEnv
    );
    const html = (await quoted?.text()) ?? "";
    expect(html).not.toContain('"><b>');
    expect(html).toContain('value="/help?q=%22%3E%3Cb%3E"');
  });

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
      new Request(
        "http://localhost/auth/login?as=contributor&returnTo=//evil.com"
      ),
      stubEnv
    );
    expect(response?.headers.get("Location")).toBe("/");
  });

  it("sets the real session cookie", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await stubLogin(
      new Request("http://localhost/auth/login?as=contributor"),
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
