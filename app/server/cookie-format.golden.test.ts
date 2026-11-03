import { describe, expect, it } from "vitest";
import { createReturnToCookie } from "./return-to.server";
import { createSessionStorage } from "./session.server";

/**
 * The exact bytes of the two signed cookies, so a session or a sign-in in
 * flight survives any change to the library that writes them. The expected
 * strings are golden: never edit them to make a test pass.
 */
const SECRET = "a-fixed-golden-secret-of-at-least-32-characters";

const TOKENS = {
  accessToken: "golden-access-token",
  refreshToken: "golden-refresh-token",
  expiresAt: 1_767_326_645_000,
};
const RETURN_TO = "/help/licence?section=attribution#credits";

const SESSION_COOKIE =
  "__Host-bt_session=eyJ0b2tlbnMiOnsiYWNjZXNzVG9rZW4iOiJnb2xkZW4tYWNjZXNzLXRva2VuIiwicmVmcmVzaFRva2VuIjoiZ29sZGVuLXJlZnJlc2gtdG9rZW4iLCJleHBpcmVzQXQiOjE3NjczMjY2NDUwMDB9fQ%3D%3D.r7qrFIIfqr6frETnJncLCqlpUlPbxwBRLwXBfa%2BWy3o; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax";
const RETURN_TO_COOKIE =
  "__Host-bt_return_to=Ii9oZWxwL2xpY2VuY2U%2Fc2VjdGlvbj1hdHRyaWJ1dGlvbiNjcmVkaXRzIg%3D%3D.a93r5KCm%2FZY6bliG4lQbhvB3xtsZy8V0%2FO%2BpH0RJipw; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax";

/** The `name=value` pair a browser sends back from a Set-Cookie header. */
const cookiePair = (setCookie: string) => setCookie.split(";")[0]!;

describe("__Host-bt_session", () => {
  it("serialises a session to the golden Set-Cookie string", async () => {
    const storage = createSessionStorage(SECRET);
    const session = await storage.getSession();
    session.set("tokens", TOKENS);
    expect(await storage.commitSession(session)).toBe(SESSION_COOKIE);
  });

  it("parses the golden cookie back to the session", async () => {
    const storage = createSessionStorage(SECRET);
    const session = await storage.getSession(cookiePair(SESSION_COOKIE));
    expect(session.get("tokens")).toEqual(TOKENS);
  });
});

describe("__Host-bt_return_to", () => {
  it("serialises a returnTo to the golden Set-Cookie string", async () => {
    expect(await createReturnToCookie(SECRET).serialize(RETURN_TO)).toBe(
      RETURN_TO_COOKIE
    );
  });

  it("parses the golden cookie back to the returnTo", async () => {
    expect(
      await createReturnToCookie(SECRET).parse(cookiePair(RETURN_TO_COOKIE))
    ).toBe(RETURN_TO);
  });
});
