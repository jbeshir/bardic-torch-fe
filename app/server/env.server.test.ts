import { afterEach, describe, expect, it, vi } from "vitest";
import { configurationErrorResponse, ENV_NAMES, parseEnv } from "./env.server";

const valid = {
  BARDIC_TORCH_API_BASE_URL: "https://api.bardictorch.org",
  AUTH_SESSION_SECRET: "x".repeat(32),
  AUTH0_DOMAIN: "bardictorch.us.auth0.com",
  AUTH0_CLIENT_ID: "client-id",
  AUTH0_CLIENT_SECRET: "client-secret",
  AUTH0_DEFAULT_REDIRECT_URI: "https://bardictorch.org",
  AUTH0_AUDIENCE: "https://api.bardictorch.org",
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
    const result = parseEnv(valid);
    expect(result).toEqual({
      ok: true,
      env: { ...valid, AUTH_MODE: "auth0" },
    });
  });

  it("returns a frozen environment", () => {
    const result = parseEnv(valid);
    expect(result.ok && Object.isFrozen(result.env)).toBe(true);
  });

  it("drops bindings it does not know, such as ASSETS", () => {
    const result = parseEnv({ ...valid, ASSETS: { fetch() {} } });
    expect(result.ok && "ASSETS" in result.env).toBe(false);
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

  it("requires a session secret of at least 32 characters", () => {
    expect(
      problemsFor({ ...valid, AUTH_SESSION_SECRET: "x".repeat(31) })
    ).toEqual(["AUTH_SESSION_SECRET: Must be at least 32 characters long"]);
  });

  it.each([
    ["BARDIC_TORCH_API_BASE_URL", "api.bardictorch.org"],
    ["BARDIC_TORCH_API_BASE_URL", "javascript:alert(1)"],
    ["AUTH0_DEFAULT_REDIRECT_URI", "ftp://bardictorch.org"],
    ["AUTH0_DOMAIN", "https://tenant.auth0.com"],
    ["AUTH0_DOMAIN", "tenant.auth0.com/evil"],
    ["AUTH0_CLIENT_ID", ""],
    ["SENTRY_DSN", "not a url"],
    ["AUTH_MODE", "admin"],
  ])("rejects %s=%j", (name, value) => {
    expect(problemsFor({ ...valid, [name]: value })).toEqual([
      expect.stringMatching(`^${name}: `),
    ]);
  });

  it.each([
    ["AUTH0_CLIENT_ID", "replace-with-the-auth0-client-id"],
    ["AUTH0_CLIENT_SECRET", "replace-with-client-secret"],
    ["AUTH0_AUDIENCE", "replace-with-api-audience"],
    ["AUTH0_DOMAIN", "replace-with.auth0.com"],
    [
      "AUTH_SESSION_SECRET",
      "replace-with-a-random-string-of-at-least-32-characters",
    ],
    ["BARDIC_TORCH_API_BASE_URL", "replace-with-https://api.example"],
  ])("rejects the repository's placeholder in %s", (name, placeholder) => {
    expect(problemsFor({ ...valid, [name]: placeholder })).toContain(
      `${name}: Still a placeholder: set the real value`
    );
  });

  it("keeps saying Required for an empty value", () => {
    expect(problemsFor({ ...valid, AUTH0_CLIENT_ID: "" })).toEqual([
      "AUTH0_CLIENT_ID: Required",
    ]);
  });

  it("never echoes a value in its problems", () => {
    const secret = "short-secret-value";
    const problems = problemsFor({ ...valid, AUTH_SESSION_SECRET: secret });
    expect(problems.join("\n")).not.toContain(secret);
  });

  it("treats empty optional values as unset", () => {
    const result = parseEnv({ ...valid, SENTRY_DSN: "", AUTH_MODE: "" });
    expect(result.ok && result.env.SENTRY_DSN).toBeUndefined();
    expect(result.ok && result.env.AUTH_MODE).toBe("auth0");
  });

  it("accepts AUTH_MODE=stub and a Sentry DSN", () => {
    const result = parseEnv({
      ...valid,
      AUTH_MODE: "stub",
      SENTRY_DSN: "https://key@o1.ingest.sentry.io/2",
    });
    expect(result.ok && result.env.AUTH_MODE).toBe("stub");
    expect(result.ok && result.env.SENTRY_DSN).toBe(
      "https://key@o1.ingest.sentry.io/2"
    );
  });

  it("lists every variable it reads", () => {
    expect([...ENV_NAMES].sort()).toEqual(
      [...Object.keys(valid), "SENTRY_DSN", "AUTH_MODE"].sort()
    );
  });
});

describe("configurationErrorResponse", () => {
  it("serves an uncached 500 page and logs the problems", async () => {
    const consoleError = vi.spyOn(console, "error").mockReturnValue();
    const response = configurationErrorResponse([
      "AUTH0_DOMAIN: Must be a host name",
    ]);
    expect(response.status).toBe(500);
    expect(response.headers.get("Content-Type")).toBe(
      "text/html; charset=utf-8"
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const html = await response.text();
    expect(html).toContain("<h1>Site configuration error</h1>");
    expect(html).not.toContain("AUTH0_DOMAIN");
    expect(consoleError).toHaveBeenCalledWith(
      "Invalid environment:\nAUTH0_DOMAIN: Must be a host name"
    );
  });
});
