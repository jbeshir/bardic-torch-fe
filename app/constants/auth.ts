// Session cookie duration in seconds (7 days).
// Token expiry is checked separately via shouldRefreshToken.
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

// How far before token expiry we proactively refresh (5 minutes).
export const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

// Fallback token expiry if Auth0 doesn't provide one (24 hours).
export const DEFAULT_TOKEN_EXPIRY_SECONDS = 86400;

// How long a call to Auth0 (code exchange, refresh, revocation) may take
// before the request goes on without it, so a hanging Auth0 never hangs a
// page load.
export const AUTH0_TIMEOUT_MS = 5_000;

export function buildAuthorizationHeader(accessToken: string): string {
  return `Bearer ${accessToken}`;
}
