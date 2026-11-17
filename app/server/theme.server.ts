import type { Theme } from "~/styles/tokens";

/**
 * The `theme` cookie holds an explicit choice, `light` or `dark`. No cookie
 * means "follow the device", so choosing System deletes it.
 * It is only a display preference, so it isn't signed.
 */

const COOKIE_NAME = "theme";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const FLAGS = "Path=/; HttpOnly; Secure; SameSite=Lax";

function isTheme(value: string | undefined): value is Theme {
  return value === "light" || value === "dark";
}

/** The explicit theme in the request's cookies, or null for System. */
export function readTheme(request: Request): Theme | null {
  const header = request.headers.get("Cookie") ?? "";
  const value = header
    .split(";")
    .map(part => part.trim().split("="))
    .find(([name]) => name === COOKIE_NAME)?.[1];
  return isTheme(value) ? value : null;
}

/** A `Set-Cookie` value that stores `theme`, or deletes it for System. */
export function themeCookie(theme: Theme | null): string {
  return theme === null
    ? `${COOKIE_NAME}=; Max-Age=0; ${FLAGS}`
    : `${COOKIE_NAME}=${theme}; Max-Age=${ONE_YEAR_SECONDS}; ${FLAGS}`;
}
