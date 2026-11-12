import { afterEach, describe, expect, it, vi } from "vitest";
import { configurationErrorResponse, parseEnv } from "./env.server";

const valid = {
  BARDIC_TORCH_API_BASE_URL: "https://api.bardictorch.org",
  AUTH_SESSION_SECRET: "x".repeat(32),
  AUTH0_DOMAIN: "bardictorch.us.auth0.com",
  AUTH0_CLIENT_ID: "client-id",
  AUTH0_CLIENT_SECRET: "client-secret",
  AUTH0_DEFAULT_REDIRECT_URI: "https://bardictorch.org",
  AUTH0_AUDIENCE: "https://api.bardictorch.org",
  TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
};

function problemsFor(raw: Record<string, unknown>) {
  const result = parseEnv(raw);
  return result.ok ? [] : result.problems;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseEnv", () => {
  it("accepts a complete environment and defaults AUTH_MODE to auth0", () => {
    expect(parseEnv(valid)).toEqual({
      ok: true,
      env: { ...valid, AUTH_MODE: "auth0" },
    });
  });

  it("strips trailing slashes from URLs", () => {
    const result = parseEnv({
      ...valid,
      BARDIC_TORCH_API_BASE_URL: "http://127.0.0.1:4010/",
      AUTH0_DEFAULT_REDIRECT_URI: "https://bardictorch.org//",
    });
    expect(result.ok && result.env.BARDIC_TORCH_API_BASE_URL).toBe(
      "http://127.0.0.1:4010"
    );
    expect(result.ok && result.env.AUTH0_DEFAULT_REDIRECT_URI).toBe(
      "https://bardictorch.org"
    );
  });

  it.each(Object.keys(valid))("reports a missing %s by name", name => {
    const { [name]: _removed, ...rest } = valid as Record<string, string>;
    expect(problemsFor(rest)).toEqual([expect.stringMatching(`^${name}: `)]);
  });

  it.each([
    ["AUTH_SESSION_SECRET", "x".repeat(31)],
    ["BARDIC_TORCH_API_BASE_URL", "javascript:alert(1)"],
    ["AUTH0_DEFAULT_REDIRECT_URI", "ftp://bardictorch.org"],
    ["AUTH0_DOMAIN", "https://tenant.auth0.com"],
    ["SENTRY_DSN", "not a url"],
    ["AUTH_MODE", "admin"],
    ["AUTH0_CLIENT_ID", "replace-with-the-auth0-client-id"],
  ])("rejects %s=%j", (name, value) => {
    expect(problemsFor({ ...valid, [name]: value })).toEqual([
      expect.stringMatching(`^${name}: `),
    ]);
  });

  it("never echoes a value in its problems", () => {
    const secret = "short-secret-value";
    const problems = problemsFor({ ...valid, AUTH_SESSION_SECRET: secret });
    expect(problems.join("\n")).not.toContain(secret);
  });
});

describe("configurationErrorResponse", () => {
  it("serves an uncached 500 page and logs the problems", async () => {
    const consoleError = vi.spyOn(console, "error").mockReturnValue();
    const response = configurationErrorResponse([
      "AUTH0_DOMAIN: Must be a host name",
    ]);
    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).not.toContain("AUTH0_DOMAIN");
    expect(consoleError).toHaveBeenCalledWith(
      "Invalid environment:\nAUTH0_DOMAIN: Must be a host name"
    );
  });
});
