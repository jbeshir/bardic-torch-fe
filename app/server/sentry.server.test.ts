import { describe, expect, it } from "vitest";
import { sentryOptions } from "./sentry.server";

describe("sentryOptions", () => {
  it.each([
    ["unset", {}],
    ["empty", { SENTRY_DSN: "" }],
  ])("has no DSN when SENTRY_DSN is %s, so nothing is sent", (_case, env) => {
    expect(sentryOptions(env)).not.toHaveProperty("dsn");
  });

  it("uses SENTRY_DSN when it is set", () => {
    const dsn = "https://public@o1.ingest.sentry.io/42";
    expect(sentryOptions({ SENTRY_DSN: dsn })).toEqual({
      dsn,
      tracesSampleRate: 0.1,
    });
  });
});
