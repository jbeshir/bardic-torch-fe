import { describe, expect, it } from "vitest";
import { APP_ORIGIN } from "~/test/context";
import { runAction } from "~/test/proxy";
import { action, loader } from "./resources.theme";

const SAME_ORIGIN = { Origin: APP_ORIGIN };

function post(
  fields: Record<string, string>,
  headers: Record<string, string> = SAME_ORIGIN
) {
  return new Request(`${APP_ORIGIN}/resources/theme`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body: new URLSearchParams(fields).toString(),
  });
}

function setCookie(response: Response) {
  return response.headers.get("Set-Cookie") ?? "";
}

describe("POST /resources/theme without JS (with returnTo)", () => {
  it.each(["light", "dark"])(
    "stores %s and redirects 303 back to the page",
    async theme => {
      const response = await runAction(
        action,
        post({ theme, returnTo: "/help/licence?x=1" })
      );
      expect(response.status).toBe(303);
      expect(response.headers.get("Location")).toBe("/help/licence?x=1");
      const cookie = setCookie(response);
      expect(cookie).toMatch(new RegExp(`^theme=${theme};`));
      for (const flag of [
        "Max-Age=31536000",
        "Path=/",
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
      ]) {
        expect(cookie).toContain(flag);
      }
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  );

  it("deletes the cookie for System", async () => {
    const response = await runAction(
      action,
      post({ theme: "system", returnTo: "/" })
    );
    expect(response.status).toBe(303);
    expect(setCookie(response)).toMatch(/^theme=; Max-Age=0;/);
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "https://evil.com/",
    "javascript:alert(1)",
    "/%2F%2Fevil.com",
    "/auth/login",
    "",
  ])("sends an unsafe returnTo %j home instead", async returnTo => {
    const response = await runAction(action, post({ theme: "dark", returnTo }));
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/");
  });
});

describe("POST /resources/theme from the fetcher (no returnTo)", () => {
  it("answers JSON with the cookie instead of redirecting", async () => {
    const response = await runAction(action, post({ theme: "dark" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, theme: "dark" });
    expect(setCookie(response)).toMatch(/^theme=dark;/);
  });
});

describe("invalid requests", () => {
  it.each([
    ["an unknown theme", { theme: "sepia", returnTo: "/" }],
    ["a missing theme", { returnTo: "/" }],
    ["an upper-case theme", { theme: "Dark" }],
  ])("rejects %s with 400 and sets no cookie", async (_label, fields) => {
    const response = await runAction(action, post(fields));
    expect(response.status).toBe(400);
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "invalid_theme",
        message: "Choose System, Light or Dark.",
      },
    });
  });

  it("rejects a body that isn't a form with 400", async () => {
    const request = new Request(`${APP_ORIGIN}/resources/theme`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...SAME_ORIGIN },
      body: JSON.stringify({ theme: "dark" }),
    });
    const response = await runAction(action, request);
    expect(response.status).toBe(400);
  });

  it("rejects a cross-site POST with 403 and sets no cookie", async () => {
    const response = await runAction(
      action,
      post({ theme: "dark", returnTo: "/" }, { Origin: "https://evil.example" })
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });

  it("answers other methods with 405", async () => {
    const request = new Request(`${APP_ORIGIN}/resources/theme`, {
      method: "PUT",
      headers: SAME_ORIGIN,
    });
    const response = await runAction(action, request);
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
  });

  it("answers GET with 405 and sets no cookie", async () => {
    const response = loader();
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });
});
