import { createCookieSessionStorage } from "@remix-run/cloudflare";
import { SESSION_MAX_AGE_SECONDS } from "~/constants/auth";

/**
 * Server-side session management using remix-auth compatible session storage.
 *
 * Flow:
 * 1. User visits /auth/login, redirects to Auth0
 * 2. Auth0 redirects back to /auth/callback with authorization code
 * 3. Server exchanges code for tokens, stores user data in session cookie
 * 4. All loaders read auth state from session
 */

export type SessionData = {
  user: {
    id: string;
    email: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt: number;
  };
};

type SessionFlashData = {
  error: string;
};

/**
 * Create a session storage instance.
 * Must be called with the session secret from environment.
 */
export function createSessionStorage(secret: string) {
  return createCookieSessionStorage<SessionData, SessionFlashData>({
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
      // Session cookie duration - token expiry is checked separately
      maxAge: SESSION_MAX_AGE_SECONDS,
    },
  });
}

export type AppSessionStorage = ReturnType<typeof createSessionStorage>;
