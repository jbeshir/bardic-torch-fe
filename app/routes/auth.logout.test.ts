import { describe, expect, it } from "vitest";
import { APP_ORIGIN, formRequest, sessionCookie } from "~/test/context";
import { runAction } from "~/test/proxy";
import { action, loader } from "./auth.logout";

describe("/auth/logout", () => {
  it("clears the session and redirects to Auth0 logout, returning to this site", async () => {
    const response = await runAction(
      action,
      formRequest({
        method: "POST",
        path: "/auth/logout",
        headers: { Cookie: await sessionCookie() },
      })
    );

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("Location") ?? "");
    expect(`${location.origin}${location.pathname}`).toBe(
      "https://auth0.test/v2/logout"
    );
    expect(location.searchParams.get("client_id")).toBe("client-id");
    expect(location.searchParams.get("returnTo")).toBe(APP_ORIGIN);
    expect(response.headers.get("Set-Cookie")).toMatch(
      /^__Host-bt_session=;.*Expires=Thu, 01 Jan 1970/
    );
  });

  it("rejects a cross-site POST without touching the session", async () => {
    const response = await runAction(
      action,
      formRequest({
        method: "POST",
        path: "/auth/logout",
        headers: {
          Origin: "https://evil.example",
          Cookie: await sessionCookie(),
        },
      })
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });

  it("does not sign out on GET", async () => {
    const response = await loader();
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/");
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });
});
