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
import { TOKEN_NAME_RULE } from "~/schemas/rules";
import { API_BASE_URL, formRequest, sessionCookie } from "~/test/context";
import { runAction } from "~/test/proxy";
import { action } from "./api.tokens";

const server = setupServer();
const created = {
  id: "6f1c1f0e-8a4b-4f43-9a5e-2d7c0b1e3a55",
  prefix: "0123abcd",
  name: "Laptop",
  created_at: "2026-10-31T12:00:00Z",
  last_used_at: null,
  token: `user_api|${"0123abcd".repeat(8)}`,
};
const sent: unknown[] = [];

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  sent.length = 0;
  vi.restoreAllMocks();
});
afterAll(() => server.close());

function upstream(respond: () => Response) {
  server.use(
    http.post(`${API_BASE_URL}/v1/tokens`, async ({ request }) => {
      sent.push(await request.json());
      return respond();
    })
  );
}

async function post(form: Record<string, string>) {
  return runAction(
    action,
    formRequest({
      method: "POST",
      path: "/api/tokens",
      form,
      headers: { Cookie: await sessionCookie() },
    })
  );
}

function upstreamError(status: number, code: string) {
  return () => HttpResponse.json({ code, message: "detail" }, { status });
}

describe("POST /api/tokens", () => {
  it("creates a named token and returns the secret with 201", async () => {
    upstream(() => HttpResponse.json(created, { status: 201 }));
    const response = await post({ name: " Laptop " });
    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true, data: created });
    expect(sent).toEqual([{ name: "Laptop" }]);
  });

  it.each([
    ["no name field", {}],
    ["a blank name", { name: "   " }],
  ])("sends {} for %s", async (_label, form) => {
    upstream(() =>
      HttpResponse.json({ ...created, name: null }, { status: 201 })
    );
    const response = await post(form);
    expect(response.status).toBe(201);
    expect(sent).toEqual([{}]);
  });

  it("accepts a name of exactly 128 characters", async () => {
    upstream(() => HttpResponse.json(created, { status: 201 }));
    const response = await post({ name: "x".repeat(128) });
    expect(response.status).toBe(201);
  });

  it("rejects a name over 128 characters", async () => {
    const response = await post({ name: "x".repeat(129) });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "invalid_request",
        message: "Check the highlighted fields.",
        fields: [
          {
            field: "name",
            message: "Token names can be up to 128 characters.",
          },
        ],
      },
    });
    expect(sent).toEqual([]);
  });

  it("returns 401 when signed out", async () => {
    const response = await runAction(
      action,
      formRequest({ method: "POST", path: "/api/tokens" })
    );
    expect(response.status).toBe(401);
  });

  it("explains the 10-token limit on 409 token_limit_reached", async () => {
    upstream(upstreamError(409, "token_limit_reached"));
    const response = await post({});
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "token_limit_reached",
        message:
          "You already have 10 API tokens, the most allowed. Revoke one before creating another.",
      },
    });
  });

  it.each([
    ["api_token_not_allowed", "API tokens can't manage API tokens."],
    ["user_blocked", "Your account is blocked"],
  ])("explains 403 %s", async (code, message) => {
    upstream(upstreamError(403, code));
    const response = await post({});
    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: { message: string } };
    expect(body.error.message).toContain(message);
  });

  it("turns an upstream 400 into a name field error", async () => {
    upstream(upstreamError(400, "invalid_request"));
    const response = await post({ name: "Laptop" });
    expect(await response.json()).toMatchObject({
      error: { fields: [{ field: "name", message: TOKEN_NAME_RULE }] },
    });
  });

  it("keeps the status of an upstream 500 with the app's copy", async () => {
    upstream(upstreamError(500, "internal"));
    const response = await post({});
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "internal",
        message: "Bardic Torch couldn't do that just now. Try again shortly.",
      },
    });
  });

  it("maps a created token without its secret to 502", async () => {
    vi.spyOn(console, "error").mockReturnValue();
    const { token: _token, ...withoutSecret } = created;
    upstream(() => HttpResponse.json(withoutSecret, { status: 201 }));
    const response = await post({});
    expect(response.status).toBe(502);
  });

  it("rejects multipart bodies with 415", async () => {
    const body = new FormData();
    body.set("name", "Laptop");
    const response = await runAction(
      action,
      new Request("https://app.test/api/tokens", {
        method: "POST",
        headers: { Origin: "https://app.test", Cookie: await sessionCookie() },
        body,
      })
    );
    expect(response.status).toBe(415);
  });

  it("answers PATCH with 405", async () => {
    const response = await runAction(
      action,
      formRequest({ method: "PATCH", path: "/api/tokens" })
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
  });
});
