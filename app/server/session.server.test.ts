import { describe, it, expect } from "vitest";
import { SESSION_MAX_AGE_SECONDS } from "~/constants/auth";
import { createSessionStorage, type SessionTokens } from "./session.server";

const SECRET = "a-test-secret-of-at-least-32-characters";

const tokens: SessionTokens = {
  accessToken: "access",
  refreshToken: "refresh",
  expiresAt: 1_000,
};

async function commit(secret = SECRET) {
  const storage = createSessionStorage(secret);
  const session = await storage.getSession();
  session.set("tokens", tokens);
  return { storage, setCookie: await storage.commitSession(session) };
}

describe("createSessionStorage", () => {
  it("sets a __Host- cookie that is HttpOnly, Secure, SameSite=Lax and site-wide", async () => {
    const { setCookie } = await commit();
    const attributes = setCookie.split("; ").slice(1);
    expect(setCookie).toMatch(/^__Host-bt_session=[^;]+;/);
    expect(attributes).toContain("HttpOnly");
    expect(attributes).toContain("Secure");
    expect(attributes).toContain("SameSite=Lax");
    expect(attributes).toContain("Path=/");
    expect(attributes.some(attribute => /^Domain=/i.test(attribute))).toBe(
      false
    );
  });

  it("stays under 4 KB with realistic Auth0 tokens", async () => {
    const storage = createSessionStorage(SECRET);
    const session = await storage.getSession();
    session.set("tokens", {
      accessToken: "a".repeat(1400),
      refreshToken: "r".repeat(200),
      expiresAt: Date.now(),
    });
    const setCookie = await storage.commitSession(session);
    expect(new TextEncoder().encode(setCookie).byteLength).toBeLessThan(4096);
  });

  it("expires the cookie after the session lifetime", async () => {
    const { setCookie } = await commit();
    expect(setCookie).toContain(`Max-Age=${SESSION_MAX_AGE_SECONDS}`);
  });

  it("round-trips the tokens through the cookie", async () => {
    const { storage, setCookie } = await commit();
    const session = await storage.getSession(setCookie.split(";")[0]);
    expect(session.get("tokens")).toEqual(tokens);
  });

  it("does not store the token in plain text", async () => {
    const { setCookie } = await commit();
    expect(setCookie).not.toContain(tokens.accessToken);
  });

  it("rejects a cookie signed with a different secret", async () => {
    const { setCookie } = await commit();
    const other = createSessionStorage("another-secret-of-at-least-32-chars");
    const session = await other.getSession(setCookie.split(";")[0]);
    expect(session.get("tokens")).toBeUndefined();
  });

  it("destroying the session expires the cookie", async () => {
    const { storage, setCookie } = await commit();
    const session = await storage.getSession(setCookie.split(";")[0]);
    const destroyed = await storage.destroySession(session);
    expect(destroyed).toMatch(/^__Host-bt_session=;/);
    expect(destroyed).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});
