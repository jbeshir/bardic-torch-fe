import { http, HttpResponse } from "msw/http";
import { delay } from "msw/utils/delay";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  API_BASE_URL,
  APP_ORIGIN,
  loadContext,
  sessionCookie,
  sessionTokens,
} from "~/test/context";
import { DISPLAY_NAME_RULE } from "~/schemas/rules";
import { getMe, updateMe } from "./api.server";
import { contractResponse, offContractResponse } from "~/test/contract";
import { serveMocks } from "~/test/msw";

const { server } = serveMocks();
const TRY_AGAIN = "We couldn’t do that just now. Try again shortly.";

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
} as const;
const me = {
  id: "google-oauth2|1",
  display_name: "Morwen of the Marches",
  role: "contributor",
};
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
    const seen = captureUpstream("get", "/v1/me", () =>
      contractResponse("getMe", 200, me)
    );
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
      contractResponse("getMe", 401, {
        code: "unauthenticated",
        message: "token expired",
      })
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
    const seen = captureUpstream("get", "/v1/me", () =>
      contractResponse("getMe", 200, me)
    );
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
    captureUpstream("get", "/v1/me", () => contractResponse("getMe", 200, me));
    const result = await getMe(await signedInRequest(), loadContext());
    expect(result).toMatchObject({ ok: true, status: 200, data: me });
  });

  it.each([
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
      "declared",
    ],
    [
      "getMe",
      403,
      "user_blocked",
      {
        message:
          "Your account is blocked, so you can’t make changes. Contact the Bardic Torch team if you think this is a mistake.",
      },
      "declared",
    ],
    [
      "getMe",
      404,
      "not_found",
      {
        message:
          "We couldn’t find what you asked for. Reload the page and try again.",
      },
      "undeclared",
    ],
    [
      "updateMe",
      409,
      "conflict",
      {
        message:
          "Something changed while you were editing. Reload the page and try again.",
      },
      "undeclared",
    ],
    [
      "updateMe",
      413,
      "request_too_large",
      { message: "The form is too large to send." },
      "declared",
    ],
    [
      "getMe",
      403,
      "moderator_required",
      { message: "Only moderators can do that." },
      "declared",
    ],
    ["getMe", 400, "invalid_request", { message: TRY_AGAIN }, "undeclared"],
    [
      "updateMe",
      415,
      "unsupported_media_type",
      { message: TRY_AGAIN },
      "declared",
    ],
    ["getMe", 500, "internal", { message: TRY_AGAIN }, "declared"],
    [
      "updateMe",
      405,
      "method_not_allowed",
      { message: TRY_AGAIN },
      "undeclared",
    ],
  ] as const)(
    "%s: an upstream %i %s gets the app's own copy and keeps its status",
    async (operationId, status, code, expected, contract) => {
      const route = OPERATIONS[operationId];
      const body = { code, message: "upstream detail not meant for users" };
      captureUpstream(route.method, route.path, () =>
        contract === "declared"
          ? contractResponse(operationId, status, body)
          : offContractResponse(
              operationId,
              status,
              body,
              "a status the contract does not declare for this operation"
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
    ["the old nested shape", { error: { code: "internal", message: "?" } }],
  ])("maps an error body with %s to 502", async (_label, body) => {
    captureUpstream("get", "/v1/me", () =>
      offContractResponse("getMe", 500, body, "not an Error body")
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
      "/v1/me",
      () => new HttpResponse("Bad gateway", { status: 500 })
    );
    const result = await getMe(await signedInRequest(), loadContext());
    expect(result).toMatchObject({
      ok: false,
      status: 502,
      error: { code: "bad_gateway" },
    });
  });

  it.each([
    ["a platform 503 that isn't JSON", 503, "Service Unavailable"],
    [
      "a 503 Error body",
      503,
      JSON.stringify({ code: "unavailable", message: "database unavailable" }),
    ],
    [
      "the code unavailable at another status",
      500,
      JSON.stringify({ code: "unavailable", message: "database unavailable" }),
    ],
  ])(
    "maps %s to upstream_unavailable with the unreachable copy",
    async (_name, status, body) => {
      captureUpstream(
        "get",
        "/v1/me",
        () => new HttpResponse(body, { status })
      );
      const result = await getMe(await signedInRequest(), loadContext());
      expect(result).toMatchObject({
        ok: false,
        status,
        error: {
          code: "upstream_unavailable",
          message: "We couldn’t reach our servers. Try again shortly.",
        },
      });
    }
  );

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
    // Served by a stubbed fetch, not msw: msw's socket-level interception
    // keeps feeding Node's fetch after the timeout aborted it, and Node's
    // fetch then fails an internal assertion outside the test. The race
    // under test is api.server's own, between the body and the timeout.
    const answer = vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"id":'));
            },
          }),
          { headers: { "Content-Type": "application/json" } }
        )
    );
    vi.stubGlobal("fetch", answer);
    const result = await getMe(await signedInRequest(), loadContext());
    expect(answer).toHaveBeenCalledWith(
      `${API_BASE_URL}/v1/me`,
      expect.anything()
    );
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
      http.patch(`${API_BASE_URL}/v1/me`, async () => {
        await delay("infinite");
        return new HttpResponse("not JSON", { status: 200 });
      })
    );
    const result = await updateMe(await signedInRequest(), loadContext(), {
      display_name: "Morwen",
    });
    expect(asked).toHaveBeenCalledWith(10_000);
    expect(result).toMatchObject({
      ok: false,
      status: 504,
      error: {
        code: "upstream_unavailable",
        message: "Our servers took too long to answer. Try again shortly.",
      },
    });
  });
});

describe("operations", () => {
  it("updateMe sends the JSON body", async () => {
    const seen = captureUpstream("patch", "/v1/me", () =>
      contractResponse("updateMe", 200, {
        ...me,
        display_name: "Master Tobias Fiddler",
      })
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
});
