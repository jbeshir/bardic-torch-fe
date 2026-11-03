import { describe, it, expect } from "vitest";
import {
  buildAuthorizationHeader,
  SESSION_MAX_AGE_SECONDS,
  TOKEN_REFRESH_THRESHOLD_MS,
  DEFAULT_TOKEN_EXPIRY_SECONDS,
} from "./auth";

describe("auth constants", () => {
  it("buildAuthorizationHeader returns correct format", () => {
    expect(buildAuthorizationHeader("mytoken123")).toBe(
      "Bearer auth0|mytoken123"
    );
  });

  it("keeps the session cookie for seven days", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(7 * 24 * 60 * 60);
  });

  it("refreshes tokens five minutes before expiry", () => {
    expect(TOKEN_REFRESH_THRESHOLD_MS).toBe(5 * 60 * 1000);
  });

  it("assumes a 24 hour token lifetime when Auth0 gives none", () => {
    expect(DEFAULT_TOKEN_EXPIRY_SECONDS).toBe(24 * 60 * 60);
  });

  it("the refresh threshold is much shorter than the session lifetime", () => {
    expect(TOKEN_REFRESH_THRESHOLD_MS / 1000).toBeLessThan(
      SESSION_MAX_AGE_SECONDS
    );
  });
});
