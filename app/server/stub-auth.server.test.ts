import { afterEach, describe, expect, it, vi } from "vitest";
import { getOrCreateSessionStorage } from "./auth.server";
import { testEnv } from "~/test/context";
import { stubLogin } from "./stub-auth.server";

const stubEnv = testEnv({ AUTH_MODE: "stub" });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("stubLogin", () => {
  it("without ?as shows the fixture-user chooser, signing nobody in", async () => {
    const response = await stubLogin(
      new Request("http://localhost:5173/auth/login?returnTo=%2Fsettings"),
      stubEnv
    );
    expect(response?.status).toBe(200);
    expect(response?.headers.get("Set-Cookie")).toBeNull();
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
    const html = (await response?.text()) ?? "";
    expect(html).toContain(
      '<a href="/auth/login?as=contributor&amp;returnTo=%2Fsettings">Log in as the seeded contributor'
    );
    expect(html).toContain(
      '<input type="hidden" name="returnTo" value="/settings">'
    );
    expect(html).not.toMatch(/<script|style=/);
  });

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

  it("signs in the fixture user named by ?as with the real session cookie", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await stubLogin(
      new Request("http://localhost/auth/login?as=user-7&returnTo=/help"),
      stubEnv
    );
    expect(response?.headers.get("Location")).toBe("/help");
    const setCookie = response?.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toMatch(/^__Host-bt_session=[^;]+;/);
    expect(setCookie.split("; ")).toEqual(
      expect.arrayContaining(["HttpOnly", "Secure", "SameSite=Lax", "Path=/"])
    );
    const session = await getOrCreateSessionStorage(stubEnv).getSession(
      setCookie.split(";")[0]
    );
    expect(session.get("tokens")?.accessToken).toBe("fixture:user-7");
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

  it.each(["", "Contributor", "../admin", "x".repeat(65)])(
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
    const env = testEnv({ AUTH_MODE: "auth0" });
    expect(
      await stubLogin(new Request("http://localhost/auth/login"), env)
    ).toBeNull();
  });

  it.each([
    "https://bardictorch.org",
    "http://localhost.evil.example",
    "http://127.0.0.2",
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
