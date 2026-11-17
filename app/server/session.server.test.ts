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
  it("sets a signed __Host- cookie that is HttpOnly, Secure, SameSite=Lax and lasts the session lifetime", async () => {
    const { setCookie } = await commit();
    const attributes = setCookie.split("; ").slice(1);
    expect(setCookie).toMatch(/^__Host-bt_session=[^;]+;/);
    expect(setCookie).not.toContain(tokens.accessToken);
    expect(attributes).toEqual(
      expect.arrayContaining([
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
        "Path=/",
        `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
      ])
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

  it("round-trips the tokens, rejects another secret, and expires on destroy", async () => {
    const { storage, setCookie } = await commit();
    const cookie = setCookie.split(";")[0];
    const session = await storage.getSession(cookie);
    expect(session.get("tokens")).toEqual(tokens);

    const other = createSessionStorage("another-secret-of-at-least-32-chars");
    expect((await other.getSession(cookie)).get("tokens")).toBeUndefined();

    const destroyed = await storage.destroySession(session);
    expect(destroyed).toMatch(/^__Host-bt_session=;.*Expires=Thu, 01 Jan 1970/);
  });
});
