import { http, HttpResponse } from "msw/http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DISPLAY_NAME_RULE } from "~/schemas/rules";
import { API_BASE_URL, formRequest, sessionCookie } from "~/test/context";
import { runAction } from "~/test/proxy";
import { action } from "./api.me";
import { contractResponse } from "~/test/contract";
import { serveMocks } from "~/test/msw";

const { server } = serveMocks();
const me = {
  id: "google-oauth2|1",
  display_name: "Morwen of the Marches",
  role: "contributor",
};
const sent: unknown[] = [];

afterEach(() => {
  sent.length = 0;
  vi.restoreAllMocks();
});

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
  contractResponse("updateMe", 200, { ...me, ...(body as object) });

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
      "Display names can’t contain control or invisible formatting characters.",
    ],
    [
      "a zero-width space (Cf)",
      "Mor\u200bwen",
      "Display names can’t contain control or invisible formatting characters.",
    ],
    [
      "a control character (Cc)",
      "Mor\u0007wen",
      "Display names can’t contain control or invisible formatting characters.",
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
      error: {
        code: "unauthenticated",
        message:
          "You’ve been signed out. Log in again and we’ll bring you back here.",
      },
    });
  });

  it("turns an upstream 400 into a display-name field error with the app's copy", async () => {
    upstream(() =>
      contractResponse("updateMe", 400, {
        code: "invalid_request",
        message: "invalid display name",
      })
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

  it("gives an upstream code it doesn't know the try-again copy", async () => {
    upstream(() =>
      HttpResponse.json(
        { code: "a_code_from_the_future", message: "x" },
        { status: 400 }
      )
    );
    const response = await patch({ display_name: "Morwen" });
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "try_again",
        message: "We couldn’t do that just now. Try again shortly.",
      },
    });
  });

  it("maps a malformed upstream response to a 503 try again", async () => {
    vi.spyOn(console, "error").mockReturnValue();
    upstream(() => new HttpResponse("not JSON", { status: 200 }));
    const response = await patch({ display_name: "Morwen" });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "try_again" },
    });
    expect(sent).toEqual([{ display_name: "Morwen" }]);
  });

  it("clears the session on its own response when the API answers 401", async () => {
    upstream(() =>
      contractResponse("updateMe", 401, {
        code: "unauthenticated",
        message: "token revoked",
      })
    );
    const response = await patch({ display_name: "Morwen" });
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

  it("rejects bodies over 8 KB with 413", async () => {
    const response = await patch({ display_name: "x".repeat(9000) });
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      error: { code: "invalid_request" },
    });
  });
});
