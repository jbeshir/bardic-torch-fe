import { http, HttpResponse } from "msw/http";
import { delay } from "msw/utils/delay";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  API_BASE_URL,
  APP_ORIGIN,
  loadContext,
  sessionCookie,
} from "~/test/context";
import { getMe, updateMe } from "./api.server";
import { contractResponse, offContractResponse } from "~/test/contract";
import { serveMocks } from "~/test/msw";

const { server } = serveMocks();

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
    expect(upstream?.headers.get("Authorization")).toBe("Bearer access-token");
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
});

describe("responses", () => {
  it.each([
    ["non-JSON success", () => new HttpResponse("<html>", { status: 200 })],
    ["an empty success", () => new HttpResponse(null, { status: 200 })],
    ["a non-Error 500", () => new HttpResponse("Bad gateway", { status: 500 })],
    [
      "a redirect",
      () =>
        new HttpResponse(null, {
          status: 302,
          headers: { Location: "https://evil.example/" },
        }),
    ],
  ])("maps %s to 502", async (_label, respond) => {
    captureUpstream("get", "/v1/me", respond);
    const result = await getMe(await signedInRequest(), loadContext());
    expect(result).toMatchObject({
      ok: false,
      status: 502,
      error: { code: "bad_gateway" },
    });
  });

  it.each([
    ["400 invalid_request", "updateMe", 400, "invalid_request", "declared"],
    ["403 user_blocked", "getMe", 403, "user_blocked", "declared"],
    ["404 not_found", "getMe", 404, "not_found", "undeclared"],
    ["409 conflict", "updateMe", 409, "conflict", "undeclared"],
    ["500 internal", "getMe", 500, "internal", "declared"],
  ] as const)(
    "an upstream %s gets the app's own copy and keeps its status",
    async (_name, operationId, status, code, contract) => {
      const route = OPERATIONS[operationId];
      const body = { code, message: "upstream detail not meant for users" };
      captureUpstream(route.method, route.path, () =>
        contract === "declared"
          ? contractResponse(operationId, status, body)
          : offContractResponse(operationId, status, body, "undeclared status")
      );
      const result = await route.call(await signedInRequest());
      expect(result).toMatchObject({ ok: false, status, error: { code } });
      expect(JSON.stringify(result)).not.toContain("upstream detail");
    }
  );

  it.each([
    ["a platform 503 that isn't JSON", 503, "Service Unavailable"],
    [
      "the code unavailable at another status",
      500,
      JSON.stringify({ code: "unavailable", message: "database unavailable" }),
    ],
  ])("maps %s to upstream_unavailable", async (_name, status, body) => {
    captureUpstream("get", "/v1/me", () => new HttpResponse(body, { status }));
    const result = await getMe(await signedInRequest(), loadContext());
    expect(result).toMatchObject({
      ok: false,
      status,
      error: { code: "upstream_unavailable" },
    });
  });

  it("gives up on a hung API with a 504", async () => {
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
      error: { code: "upstream_unavailable" },
    });
  });
});
