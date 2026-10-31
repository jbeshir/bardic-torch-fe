import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { API_BASE_URL, formRequest, sessionCookie } from "~/test/context";
import { runAction } from "~/test/proxy";
import { action } from "./api.tokens.$tokenId";

const server = setupServer();
const revoked: string[] = [];

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  revoked.length = 0;
  vi.restoreAllMocks();
});
afterAll(() => server.close());

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
    upstream(() => new HttpResponse(null, { status: 204 }));
    const response = await remove("t1");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true, data: null });
    expect(revoked).toEqual(["/v1/tokens/t1"]);
  });

  it("encodes the token id in the upstream path", async () => {
    upstream(() => new HttpResponse(null, { status: 204 }));
    await remove("../me");
    expect(revoked).toEqual(["/v1/tokens/..%2Fme"]);
  });

  it("explains an upstream 404 not_found with the app's copy", async () => {
    upstream(() =>
      HttpResponse.json(
        { code: "not_found", message: "API token not found" },
        { status: 404 }
      )
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
      HttpResponse.json(
        { code: "api_token_not_allowed", message: "no" },
        { status: 403 }
      )
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

  it("maps a malformed upstream response to 502", async () => {
    vi.spyOn(console, "error").mockReturnValue();
    upstream(() => new HttpResponse("oops", { status: 500 }));
    const response = await remove("t1");
    expect(response.status).toBe(502);
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
