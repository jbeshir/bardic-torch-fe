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
    expect(sentryOptions({ SENTRY_DSN: dsn })).toMatchObject({
      dsn,
      tracesSampleRate: 0.1,
    });
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
    // Sentry 11 streams spans, so a trace is cleaned span by span.
    const span = beforeSendSpan?.({
      trace_id: "a".repeat(32),
      span_id: "b".repeat(16),
      name: "GET /auth/callback?code=secret&state=abc",
      start_timestamp: 1,
      status: "ok",
      is_segment: true,
      attributes: {
        "url.full": request.url,
        "http.url": request.url,
        "http.target": "/auth/callback?code=secret&state=abc",
        "http.query": "code=secret&state=abc",
        "url.query": "code=secret&state=abc",
        "http.request.method": "GET",
      },
    });
    expect(span?.name).toBe("GET /auth/callback");
    expect(span?.attributes).toEqual({
      "url.full": "https://bardictorch.org/auth/callback",
      "http.url": "https://bardictorch.org/auth/callback",
      "http.target": "/auth/callback",
      "http.request.method": "GET",
    });
    expect(JSON.stringify(span)).not.toContain("secret");
    // An event without a request is sent as it is.
    const plain = { type: undefined, message: "no request" } as const;
    expect(await beforeSend?.(plain, {})).toBe(plain);
  });
});
