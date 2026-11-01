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
import { DISPLAY_NAME_RULE } from "~/schemas/rules";
import { API_BASE_URL, formRequest, sessionCookie } from "~/test/context";
import { runAction } from "~/test/proxy";
import { action } from "./api.me";

const server = setupServer();
const me = {
  id: "google-oauth2|1",
  display_name: "Morwen of the Marches",
  role: "contributor",
};
const sent: unknown[] = [];

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  sent.length = 0;
  vi.restoreAllMocks();
});
afterAll(() => server.close());

function upstream(respond: (body: unknown) => Response) {
  server.use(
    http.patch(`${API_BASE_URL}/v1/me`, async ({ request }) => {
      const body = await request.json();
      sent.push(body);
      return respond(body);
    })
  );
}

async function patch(form: Record<string, string>, headers = {}) {
  return runAction(
    action,
    formRequest({
      method: "PATCH",
      path: "/api/me",
      form,
      headers: { Cookie: await sessionCookie(), ...headers },
    })
  );
}

const echo = (body: unknown) =>
  HttpResponse.json({ ...me, ...(body as object) });

describe("PATCH /api/me", () => {
  it("sends the trimmed name upstream as JSON and returns the user", async () => {
    upstream(echo);
    const response = await patch({ display_name: "  Master Tobias Fiddler  " });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      ok: true,
      data: { ...me, display_name: "Master Tobias Fiddler" },
    });
    expect(sent).toEqual([{ display_name: "Master Tobias Fiddler" }]);
  });

  it("normalises the name to NFC before sending it", async () => {
    upstream(echo);
    await patch({ display_name: "Cerdic\u0301" });
    expect(sent).toEqual([{ display_name: "Cerdi\u0107" }]);
  });

  it.each([
    ["exactly 64 characters", "x".repeat(64)],
    ["64 characters outside the BMP", "\u{1d11e}".repeat(64)],
    ["64 characters with surrounding spaces", ` ${"x".repeat(64)} `],
  ])("accepts %s", async (_label, name) => {
    upstream(echo);
    const response = await patch({ display_name: name });
    expect(response.status).toBe(200);
  });

  it.each([
    ["blank", "   ", "Enter a display name."],
    ["missing", undefined, "Enter a display name."],
    [
      "65 characters",
      "x".repeat(65),
      "Display names can be up to 64 characters.",
    ],
    [
      "over 256 characters before trimming",
      `${" ".repeat(250)}Morwen${" ".repeat(10)}`,
      "Display names can be up to 64 characters.",
    ],
    [
      "a right-to-left override (Cf)",
      "Morwen\u202e",
      "Display names can't contain control or invisible formatting characters.",
    ],
    [
      "a zero-width space (Cf)",
      "Mor\u200bwen",
      "Display names can't contain control or invisible formatting characters.",
    ],
    [
      "a control character (Cc)",
      "Mor\u0007wen",
      "Display names can't contain control or invisible formatting characters.",
    ],
  ])("rejects a %s name with a field error", async (_label, name, message) => {
    const response = await patch(
      name === undefined ? {} : { display_name: name }
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "invalid_request",
        message: "Check the highlighted fields.",
        fields: [{ field: "display_name", message }],
      },
    });
    expect(sent).toEqual([]);
  });

  it("returns 401 when signed out", async () => {
    const response = await runAction(
      action,
      formRequest({
        method: "PATCH",
        path: "/api/me",
        form: { display_name: "Morwen" },
      })
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      error: { code: "unauthenticated", message: "Log in to continue." },
    });
  });

  it("turns an upstream 400 into a display-name field error with the app's copy", async () => {
    upstream(() =>
      HttpResponse.json(
        { code: "invalid_request", message: "invalid display name" },
        { status: 400 }
      )
    );
    const response = await patch({ display_name: "Morwen" });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "invalid_request",
        message: "Check the display name.",
        fields: [{ field: "display_name", message: DISPLAY_NAME_RULE }],
      },
    });
  });

  it("passes on a blocked account as 403 user_blocked", async () => {
    upstream(() =>
      HttpResponse.json(
        { code: "user_blocked", message: "user is blocked" },
        { status: 403 }
      )
    );
    const response = await patch({ display_name: "Morwen" });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "user_blocked" },
    });
  });

  it("maps a malformed upstream response to 502", async () => {
    vi.spyOn(console, "error").mockReturnValue();
    upstream(() => HttpResponse.json({ nope: true }));
    const response = await patch({ display_name: "Morwen" });
    expect(response.status).toBe(502);
  });

  it("rejects JSON bodies with 415", async () => {
    const response = await runAction(
      action,
      new Request("https://app.test/api/me", {
        method: "PATCH",
        headers: {
          Origin: "https://app.test",
          "Content-Type": "application/json",
          Cookie: await sessionCookie(),
        },
        body: JSON.stringify({ display_name: "Morwen" }),
      })
    );
    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "unsupported_media_type",
        message: "Send the form as form data.",
      },
    });
    expect(sent).toEqual([]);
  });

  it("rejects bodies over 8 KB with 413", async () => {
    const response = await patch({ display_name: "x".repeat(9000) });
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      error: { code: "request_too_large" },
    });
  });

  it.each(["POST", "PUT", "DELETE"])("answers %s with 405", async method => {
    const response = await runAction(
      action,
      formRequest({ method, path: "/api/me" })
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("PATCH");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
