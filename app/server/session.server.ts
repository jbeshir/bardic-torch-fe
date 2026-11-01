import { createCookieSessionStorage } from "@remix-run/cloudflare";
import { SESSION_MAX_AGE_SECONDS } from "~/constants/auth";

/**
 * The session cookie. /auth/callback stores the reader's Auth0 tokens in it
 * and every loader reads them from there. It holds nothing else: who is
 * reading comes from /v1/me, not from the cookie, which is signed but not
 * encrypted.
 */

/** What the session holds: the API access token and how to renew it. */
export type SessionTokens = {
  readonly accessToken: string;
  /** Absent when Auth0 issued none; the session then ends at `expiresAt`. */
  readonly refreshToken?: string;
  /** When the access token expires, in epoch milliseconds. */
  readonly expiresAt: number;
};

type SessionData = {
  readonly tokens: SessionTokens;
};

/** The session storage signed with `secret` (AUTH_SESSION_SECRET). */
export function createSessionStorage(secret: string) {
  return createCookieSessionStorage<SessionData>({
    cookie: {
      // `__Host-` makes browsers insist on Secure, Path=/ and no Domain, so
      // no other subdomain can set or shadow it. Browsers treat localhost and
      // 127.0.0.1 as secure, so this also works over plain HTTP in dev/e2e.
      name: "__Host-bt_session",
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secrets: [secret],
      secure: true,
      // The cookie's lifetime; the access token's expiry is checked
      // separately on every request.
      maxAge: SESSION_MAX_AGE_SECONDS,
    },
  });
}

export type AppSessionStorage = ReturnType<typeof createSessionStorage>;
