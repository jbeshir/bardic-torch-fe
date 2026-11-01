import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, formRequest, sessionCookie } from "~/test/context";
import { runAction } from "~/test/proxy";
import { action } from "./api.tokens.$tokenId";
import { contractResponse } from "~/test/contract";
import { serveMocks } from "~/test/msw";

const { server } = serveMocks();
const revoked: string[] = [];

afterEach(() => {
  revoked.length = 0;
  vi.restoreAllMocks();
});

function upstream(respond: () => Response) {
  server.use(
    http.delete(`${API_BASE_URL}/v1/tokens/:tokenId`, ({ request }) => {
      revoked.push(new URL(request.url).pathname);
      return respond();
    })
  );
}

async function remove(tokenId: string) {
  return runAction(
    action,
    formRequest({
      method: "DELETE",
      path: `/api/tokens/${encodeURIComponent(tokenId)}`,
      headers: { Cookie: await sessionCookie() },
    }),
    { tokenId }
  );
}

describe("DELETE /api/tokens/:tokenId", () => {
  it("revokes the token and answers 200 so fetchers can read the result", async () => {
    upstream(() => contractResponse("revokeAPIToken", 204));
    const response = await remove("t1");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true, data: null });
    expect(revoked).toEqual(["/v1/tokens/t1"]);
  });

  it("encodes the token id in the upstream path", async () => {
    upstream(() => contractResponse("revokeAPIToken", 204));
    await remove("../me");
    expect(revoked).toEqual(["/v1/tokens/..%2Fme"]);
  });

  it("explains an upstream 404 not_found with the app's copy", async () => {
    upstream(() =>
      contractResponse("revokeAPIToken", 404, {
        code: "not_found",
        message: "API token not found",
      })
    );
    const response = await remove("missing");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "not_found",
        message:
          "That token no longer exists. Reload the page to see your current tokens.",
      },
    });
  });

  it("passes on 403 api_token_not_allowed", async () => {
    upstream(() =>
      contractResponse("revokeAPIToken", 403, {
        code: "api_token_not_allowed",
        message: "no",
      })
    );
    const response = await remove("t1");
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "api_token_not_allowed" },
    });
  });

  it("returns 401 when signed out", async () => {
    const response = await runAction(
      action,
      formRequest({ method: "DELETE", path: "/api/tokens/t1" }),
      { tokenId: "t1" }
    );
    expect(response.status).toBe(401);
    expect(revoked).toEqual([]);
  });

  it("clears the session on its own response when the API answers 401", async () => {
    upstream(() =>
      contractResponse("revokeAPIToken", 401, {
        code: "unauthenticated",
        message: "token revoked",
      })
    );
    const response = await remove("t1");
    expect(response.status).toBe(401);
    expect(response.headers.get("Set-Cookie")).toMatch(
      /^__Host-bt_session=;.*Expires=Thu, 01 Jan 1970/
    );
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "unauthenticated",
        message:
          "You’ve been signed out. Log in again and we’ll bring you back here.",
      },
    });
  });

  it("maps a malformed upstream response to 502", async () => {
    vi.spyOn(console, "error").mockReturnValue();
    upstream(() => new HttpResponse("oops", { status: 500 }));
    const response = await remove("t1");
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "bad_gateway" },
    });
    expect(revoked).toEqual(["/v1/tokens/t1"]);
  });

  it("answers POST with 405", async () => {
    const response = await runAction(
      action,
      formRequest({ method: "POST", path: "/api/tokens/t1" }),
      { tokenId: "t1" }
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("DELETE");
  });
});
