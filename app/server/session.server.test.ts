import { describe, it, expect } from "vitest";
import { SESSION_MAX_AGE_SECONDS } from "~/constants/auth";
import { createSessionStorage, type SessionData } from "./session.server";

const SECRET = "a-test-secret-of-at-least-32-characters";

const user: SessionData["user"] = {
  id: "auth0|1",
  email: "bard@example.test",
  accessToken: "access",
  refreshToken: "refresh",
  expiresAt: 1_000,
};

async function commit(secret = SECRET) {
  const storage = createSessionStorage(secret);
  const session = await storage.getSession();
  session.set("user", user);
  return { storage, setCookie: await storage.commitSession(session) };
}

describe("createSessionStorage", () => {
  it("sets an httpOnly, SameSite=Lax cookie scoped to the whole site", async () => {
    const { setCookie } = await commit();
    expect(setCookie).toMatch(/^__session=/);
    expect(setCookie).toMatch(/; HttpOnly/);
    expect(setCookie).toMatch(/; SameSite=Lax/);
    expect(setCookie).toMatch(/; Path=\//);
  });

  it("expires the cookie after the session lifetime", async () => {
    const { setCookie } = await commit();
    expect(setCookie).toContain(`Max-Age=${SESSION_MAX_AGE_SECONDS}`);
  });

  it("round-trips the user through the cookie", async () => {
    const { storage, setCookie } = await commit();
    const session = await storage.getSession(setCookie.split(";")[0]);
    expect(session.get("user")).toEqual(user);
  });

  it("does not store the token in plain text", async () => {
    const { setCookie } = await commit();
    expect(setCookie).not.toContain(user.accessToken);
  });

  it("rejects a cookie signed with a different secret", async () => {
    const { setCookie } = await commit();
    const other = createSessionStorage("another-secret-of-at-least-32-chars");
    const session = await other.getSession(setCookie.split(";")[0]);
    expect(session.get("user")).toBeUndefined();
  });

  it("destroying the session expires the cookie", async () => {
    const { storage, setCookie } = await commit();
    const session = await storage.getSession(setCookie.split(";")[0]);
    const destroyed = await storage.destroySession(session);
    expect(destroyed).toMatch(/^__session=;/);
    expect(destroyed).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});
