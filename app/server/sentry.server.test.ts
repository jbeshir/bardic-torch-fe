import { describe, expect, it } from "vitest";
import { sentryOptions } from "./sentry.server";

describe("sentryOptions", () => {
  it.each([
    ["unset", {}],
    ["empty", { SENTRY_DSN: "" }],
  ])("has no DSN when SENTRY_DSN is %s, so nothing is sent", (_case, env) => {
    expect(sentryOptions(env)).not.toHaveProperty("dsn");
  });

  it("sends errors and traces without the request's query string (the sign-in code and state)", async () => {
    const { beforeSend, beforeSendSpan } = sentryOptions({});
    const request = {
      url: "https://bardictorch.org/auth/callback?code=secret&state=abc",
      query_string: "code=secret&state=abc",
      method: "GET",
    };
    const sent = await beforeSend?.(
      { type: undefined, request, message: "boom" },
      {}
    );
    expect(sent).toEqual({
      type: undefined,
      message: "boom",
      request: {
        url: "https://bardictorch.org/auth/callback",
        method: "GET",
      },
    });
    const span = beforeSendSpan?.({
      trace_id: "a".repeat(32),
      span_id: "b".repeat(16),
      name: "GET /auth/callback?code=secret&state=abc",
      start_timestamp: 1,
      status: "ok",
      is_segment: true,
      attributes: {
        "url.full": request.url,
        "http.target": "/auth/callback?code=secret&state=abc",
        "http.query": "code=secret&state=abc",
        "url.query": "code=secret&state=abc",
        "http.request.method": "GET",
      },
    });
    expect(span?.name).toBe("GET /auth/callback");
    expect(JSON.stringify(span)).not.toContain("secret");
  });
});
