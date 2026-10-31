import { createCookie } from "@remix-run/cloudflare";

/**
 * Where to send the user after sign-in or a no-JS form post. The only
 * accepted values are same-site paths; anything that a browser could read
 * as another origin (`//host`, backslashes, control characters, encoded
 * variants of those, absolute or `javascript:` URLs) falls back to `/`.
 */

const FALLBACK = "/";
const MAX_LENGTH = 1024;
const BASE = "https://return-to.invalid";
/** Routes that would loop back into the sign-in flow. */
const EXCLUDED_PREFIX = "/auth/";

function hasControlCharacter(value: string): boolean {
  return [...value].some(character => {
    const code = character.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });
}

function looksLocal(path: string): boolean {
  return (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("\\") &&
    !hasControlCharacter(path)
  );
}

export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || value.length > MAX_LENGTH) return FALLBACK;
  if (!looksLocal(value)) return FALLBACK;

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return FALLBACK;
  }
  if (!looksLocal(decoded)) return FALLBACK;

  const url = new URL(value, BASE);
  if (url.origin !== BASE || url.pathname.startsWith(EXCLUDED_PREFIX)) {
    return FALLBACK;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Carries the validated returnTo through the Auth0 round trip. */
export function createReturnToCookie(secret: string) {
  return createCookie("__Host-bt_return_to", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
    secrets: [secret],
  });
}
