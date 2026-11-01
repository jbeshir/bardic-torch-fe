import { delay, http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  API_BASE_URL,
  APP_ORIGIN,
  loadContext,
  sessionCookie,
  sessionTokens,
} from "~/test/context";
import { DISPLAY_NAME_RULE, TOKEN_NAME_RULE } from "~/schemas/rules";
import {
  createApiToken,
  getMe,
  listApiTokens,
  revokeApiToken,
  updateMe,
} from "./api.server";
import { serveMocks } from "~/test/msw";

const { server } = serveMocks();
const TRY_AGAIN = "Bardic Torch couldn’t do that just now. Try again shortly.";

/** How to call each FE1 operation, for table-driven error mapping. */
const OPERATIONS = {
  getMe: {
    method: "get",
    path: "/v1/me",
    call: (request: Request) => getMe(request, loadContext()),
  },
  updateMe: {
    method: "patch",
    path: "/v1/me",
    call: (request: Request) =>
      updateMe(request, loadContext(), { display_name: "Morwen" }),
  },
  listAPITokens: {
    method: "get",
    path: "/v1/tokens",
    call: (request: Request) => listApiTokens(request, loadContext()),
  },
  createAPIToken: {
    method: "post",
    path: "/v1/tokens",
    call: (request: Request) => createApiToken(request, loadContext(), {}),
  },
  revokeAPIToken: {
    method: "delete",
    path: "/v1/tokens/:tokenId",
    call: (request: Request) => revokeApiToken(request, loadContext(), "t1"),
  },
} as const;
const me = {
  id: "google-oauth2|1",
  display_name: "Morwen of the Marches",
  role: "contributor",
};
const token = {
  id: "6f1c1f0e-8a4b-4f43-9a5e-2d7c0b1e3a55",
  prefix: "0123abcd",
  name: null,
  created_at: "2026-01-01T00:00:00Z",
  last_used_at: "2026-02-01T00:00:00+01:00",
};
const secret = `user_api|${"0123abcd".repeat(8)}`;

beforeEach(() => {
  vi.spyOn(console, "error").mockReturnValue();
});
afterEach(() => {
  vi.restoreAllMocks();
});

async function signedInRequest(headers: Record<string, string> = {}) {
  return new Request(`${APP_ORIGIN}/settings`, {
    headers: { Cookie: await sessionCookie(), ...headers },
  });
}

function captureUpstream(
  method: "get" | "patch" | "post" | "delete",
  path: string,
  respond: () => Response
) {
  const seen: Array<{ url: string; headers: Headers; body: string }> = [];
  server.use(
    http[method](`${API_BASE_URL}${path}`, async ({ request }) => {
      seen.push({
        url: request.url,
        headers: request.headers,
        body: await request.text(),
      });
      return respond();
    })
  );
  return seen;
}

describe("authentication", () => {
  it("returns 401 without calling the API when signed out", async () => {
    const result = await getMe(
      new Request(`${APP_ORIGIN}/settings`),
      loadContext()
    );
    expect(result).toMatchObject({
      ok: false,
      status: 401,
      error: { code: "unauthenticated", message: "Log in to continue." },
    });
  });

  it("sends the session's bearer token and nothing from the client", async () => {
    const seen = captureUpstream("get", "/v1/me", () => HttpResponse.json(me));
    await getMe(
      await signedInRequest({
        Authorization: "Bearer client-supplied",
        "X-Forwarded-For": "203.0.113.9",
      }),
      loadContext()
    );
    const upstream = seen[0];
    expect(upstream?.headers.get("Authorization")).toBe(
      "Bearer auth0|access-token"
    );
    expect(upstream?.headers.get("Cookie")).toBeNull();
    expect(upstream?.headers.get("X-Forwarded-For")).toBeNull();
    expect(upstream?.headers.get("Accept")).toBe("application/json");
  });

  it("clears the session when the API answers 401", async () => {
    captureUpstream("get", "/v1/me", () =>
      HttpResponse.json(
        { code: "unauthenticated", message: "token expired" },
        { status: 401 }
      )
    );
    const result = await getMe(await signedInRequest(), loadContext());
    expect(result).toMatchObject({
      ok: false,
      status: 401,
      error: {
        code: "unauthenticated",
        message:
          "You’ve been signed out. Log in again and we’ll bring you back here.",
      },
    });
    expect(result.headers.get("Set-Cookie")).toMatch(
      /^__Host-bt_session=;.*Expires=Thu, 01 Jan 1970/
    );
  });

  it("carries a refreshed session cookie on the result", async () => {
    server.use(
      http.post("https://auth0.test/oauth/token", () =>
        HttpResponse.json({
          access_token: "refreshed-access",
          refresh_token: "refreshed-refresh",
          expires_in: 3600,
          token_type: "Bearer",
        })
      )
    );
    const seen = captureUpstream("get", "/v1/me", () => HttpResponse.json(me));
    const request = new Request(`${APP_ORIGIN}/settings`, {
      headers: {
        Cookie: await sessionCookie(sessionTokens({ expiresAt: Date.now() })),
      },
    });
    const result = await getMe(request, loadContext());
    expect(result.ok).toBe(true);
    expect(seen[0]?.headers.get("Authorization")).toBe(
      "Bearer auth0|refreshed-access"
    );
    expect(result.headers.get("Set-Cookie")).toMatch(/^__Host-bt_session=\S/);
  });
});

describe("responses", () => {
  it("returns validated data", async () => {
    captureUpstream("get", "/v1/me", () => HttpResponse.json(me));
    const result = await getMe(await signedInRequest(), loadContext());
    expect(result).toMatchObject({ ok: true, status: 200, data: me });
  });

  it("drops fields the contract does not know", async () => {
    captureUpstream("get", "/v1/me", () =>
      HttpResponse.json({ ...me, email: "private@example.test" })
    );
    const result = await getMe(await signedInRequest(), loadContext());
    expect(result.ok && result.data).toEqual(me);
  });

  it.each([
    ["a body missing fields", () => HttpResponse.json({ id: "u1" })],
    ["a wrong role", () => HttpResponse.json({ ...me, role: "admin" })],
    ["non-JSON", () => new HttpResponse("<html>", { status: 200 })],
    ["an empty body", () => new HttpResponse(null, { status: 200 })],
  ])("maps a success with %s to 502", async (_label, respond) => {
    captureUpstream("get", "/v1/me", respond);
    const result = await getMe(await signedInRequest(), loadContext());
    expect(result).toMatchObject({
      ok: false,
      status: 502,
      error: { code: "bad_gateway" },
    });
    expect(console.error).toHaveBeenCalled();
  });

  it.each([
    [
      "updateMe",
      400,
      "invalid_request",
      {
        message: "Check the display name.",
        fields: [{ field: "display_name", message: DISPLAY_NAME_RULE }],
      },
    ],
    [
      "createAPIToken",
      400,
      "invalid_request",
      {
        message: "Check the token name.",
        fields: [{ field: "name", message: TOKEN_NAME_RULE }],
      },
    ],
    [
      "getMe",
      403,
      "user_blocked",
      {
        message:
          "Your account is blocked, so you can’t make changes. Contact the Bardic Torch team if you think this is a mistake.",
      },
    ],
    [
      "createAPIToken",
      403,
      "api_token_not_allowed",
      {
        message:
          "API tokens can’t manage API tokens. Log in on the website to do this.",
      },
    ],
    [
      "createAPIToken",
      409,
      "token_limit_reached",
      {
        message:
          "You already have 10 API tokens, the most allowed. Revoke one before creating another.",
      },
    ],
    [
      "revokeAPIToken",
      404,
      "not_found",
      {
        message:
          "That token no longer exists. Reload the page to see your current tokens.",
      },
    ],
    [
      "getMe",
      404,
      "not_found",
      {
        message:
          "Bardic Torch couldn’t find what you asked for. Reload the page and try again.",
      },
    ],
    [
      "updateMe",
      409,
      "conflict",
      {
        message:
          "Something changed while you were editing. Reload the page and try again.",
      },
    ],
    [
      "updateMe",
      413,
      "request_too_large",
      { message: "The form is too large to send." },
    ],
    [
      "getMe",
      403,
      "moderator_required",
      { message: "Only moderators can do that." },
    ],
    ["listAPITokens", 400, "invalid_request", { message: TRY_AGAIN }],
    ["updateMe", 415, "unsupported_media_type", { message: TRY_AGAIN }],
    ["getMe", 500, "internal", { message: TRY_AGAIN }],
    ["listAPITokens", 503, "unavailable", { message: TRY_AGAIN }],
  ] as const)(
    "%s: an upstream %i %s gets the app's own copy and keeps its status",
    async (operationId, status, code, expected) => {
      const route = OPERATIONS[operationId];
      captureUpstream(route.method, route.path, () =>
        HttpResponse.json(
          { code, message: "upstream detail not meant for users" },
          { status }
        )
      );
      const result = await route.call(await signedInRequest());
      expect(result).toEqual({
        ok: false,
        status,
        error: { code, ...expected },
        headers: expect.any(Headers),
      });
    }
  );

  it.each([
    ["an unknown code", { code: "teapot", message: "?" }],
    ["the old nested shape", { error: { code: "internal", message: "?" } }],
  ])("maps an error body with %s to 502", async (_label, body) => {
    captureUpstream("get", "/v1/me", () =>
      HttpResponse.json(body, { status: 500 })
    );
    const result = await getMe(await signedInRequest(), loadContext());
    expect(result).toMatchObject({
      ok: false,
      status: 502,
      error: { code: "bad_gateway" },
    });
  });

  it("maps a redirect to 502 without following it", async () => {
    const seen = captureUpstream(
      "get",
      "/v1/me",
      () =>
        new HttpResponse(null, {
          status: 302,
          headers: { Location: "https://evil.example/" },
        })
    );
    const result = await getMe(await signedInRequest(), loadContext());
    expect(result).toMatchObject({
      ok: false,
      status: 502,
      error: { code: "bad_gateway" },
    });
    // Following it would be an unhandled request to evil.example.
    expect(seen).toHaveLength(1);
  });

  it("maps an error without an Error body to 502", async () => {
    captureUpstream(
      "get",
      "/v1/tokens",
      () => new HttpResponse("Bad gateway", { status: 503 })
    );
    const result = await listApiTokens(await signedInRequest(), loadContext());
    expect(result).toMatchObject({
      ok: false,
      status: 502,
      error: { code: "bad_gateway" },
    });
  });

  it("maps a network failure to 502", async () => {
    server.use(http.get(`${API_BASE_URL}/v1/me`, () => HttpResponse.error()));
    const result = await getMe(await signedInRequest(), loadContext());
    expect(result).toMatchObject({
      ok: false,
      status: 502,
      error: { code: "upstream_unavailable" },
    });
  });
});

describe("upstream body failures", () => {
  it("maps a body that breaks off midway to 502", async () => {
    const seen = captureUpstream(
      "get",
      "/v1/me",
      () =>
        new HttpResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"id":'));
              controller.error(new TypeError("connection reset"));
            },
          }),
          { headers: { "Content-Type": "application/json" } }
        )
    );
    const result = await getMe(await signedInRequest(), loadContext());
    expect(seen).toHaveLength(1);
    expect(result).toMatchObject({
      ok: false,
      status: 502,
      error: { code: "upstream_unavailable" },
    });
  });

  it("gives up on a body that stalls past the timeout with a 504", async () => {
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() => timeout(20));
    captureUpstream(
      "get",
      "/v1/me",
      () =>
        new HttpResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"id":'));
            },
          }),
          { headers: { "Content-Type": "application/json" } }
        )
    );
    const result = await getMe(await signedInRequest(), loadContext());
    expect(result).toMatchObject({
      ok: false,
      status: 504,
      error: { code: "upstream_unavailable" },
    });
  });
});

describe("upstream timeout", () => {
  it("gives up on a hung API with a 504, so the form can say so", async () => {
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    const asked = vi
      .spyOn(AbortSignal, "timeout")
      .mockImplementation(() => timeout(20));
    server.use(
      http.post(`${API_BASE_URL}/v1/tokens`, async () => {
        await delay("infinite");
        return HttpResponse.json({});
      })
    );
    const result = await createApiToken(
      await signedInRequest(),
      loadContext(),
      {
        name: "Laptop",
      }
    );
    expect(asked).toHaveBeenCalledWith(10_000);
    expect(result).toMatchObject({
      ok: false,
      status: 504,
      error: {
        code: "upstream_unavailable",
        message: "Bardic Torch took too long to answer. Try again shortly.",
      },
    });
  });
});

describe("operations", () => {
  it("updateMe sends the JSON body", async () => {
    const seen = captureUpstream("patch", "/v1/me", () =>
      HttpResponse.json({ ...me, display_name: "Master Tobias Fiddler" })
    );
    const result = await updateMe(await signedInRequest(), loadContext(), {
      display_name: "Master Tobias Fiddler",
    });
    expect(result.ok && result.data.display_name).toBe("Master Tobias Fiddler");
    expect(seen[0]?.headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({
      display_name: "Master Tobias Fiddler",
    });
  });

  it("listApiTokens validates every token", async () => {
    captureUpstream("get", "/v1/tokens", () =>
      HttpResponse.json({ data: [token] })
    );
    const result = await listApiTokens(await signedInRequest(), loadContext());
    expect(result).toMatchObject({ ok: true, data: { data: [token] } });
  });

  it.each([
    ["a malformed date", { created_at: "yesterday" }],
    ["a prefix that is not 8 hex digits", { prefix: "bt_ab" }],
    ["an empty name", { name: "" }],
  ])("listApiTokens rejects a token with %s", async (_label, change) => {
    captureUpstream("get", "/v1/tokens", () =>
      HttpResponse.json({ data: [{ ...token, ...change }] })
    );
    const result = await listApiTokens(await signedInRequest(), loadContext());
    expect(result).toMatchObject({ ok: false, status: 502 });
  });

  it("createApiToken returns the one-time secret with status 201", async () => {
    const created = {
      ...token,
      name: "CI runner",
      last_used_at: null,
      token: secret,
    };
    const seen = captureUpstream("post", "/v1/tokens", () =>
      HttpResponse.json(created, { status: 201 })
    );
    const result = await createApiToken(
      await signedInRequest(),
      loadContext(),
      { name: "CI runner" }
    );
    expect(result).toMatchObject({ ok: true, status: 201, data: created });
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({ name: "CI runner" });
  });

  it("createApiToken rejects a secret without the user_api| prefix", async () => {
    captureUpstream("post", "/v1/tokens", () =>
      HttpResponse.json(
        { ...token, token: "0123abcd".repeat(8) },
        { status: 201 }
      )
    );
    const result = await createApiToken(
      await signedInRequest(),
      loadContext(),
      {}
    );
    expect(result).toMatchObject({ ok: false, status: 502 });
  });

  it("revokeApiToken encodes the id and accepts 204", async () => {
    const seen = captureUpstream(
      "delete",
      "/v1/tokens/:tokenId",
      () => new HttpResponse(null, { status: 204 })
    );
    const result = await revokeApiToken(
      await signedInRequest(),
      loadContext(),
      "a/b?c"
    );
    expect(result).toMatchObject({ ok: true, status: 204, data: null });
    expect(new URL(seen[0]?.url ?? "").pathname).toBe("/v1/tokens/a%2Fb%3Fc");
    expect(seen[0]?.headers.get("Content-Type")).toBeNull();
  });

  it("revokeApiToken rejects a success that has a body", async () => {
    captureUpstream("delete", "/v1/tokens/:tokenId", () =>
      HttpResponse.json({ unexpected: true })
    );
    const result = await revokeApiToken(
      await signedInRequest(),
      loadContext(),
      "t1"
    );
    expect(result).toMatchObject({ ok: false, status: 502 });
  });
});
