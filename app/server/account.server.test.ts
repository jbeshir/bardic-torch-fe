import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import {
  API_BASE_URL,
  APP_ORIGIN,
  loadContext,
  sessionCookie,
  sessionTokens,
} from "~/test/context";
import { serveFixtureApi } from "~/test/msw";
import { loadAccount } from "./account.server";

const fixtures = serveFixtureApi();

async function load(cookie?: string) {
  return loadAccount(
    new Request(`${APP_ORIGIN}/`, {
      headers: cookie ? { Cookie: cookie } : {},
    }),
    loadContext()
  );
}

const contributor = () =>
  sessionCookie(sessionTokens({ accessToken: "fixture:contributor" }));

describe("loadAccount", () => {
  it("is signed out without a session", async () => {
    const { account, headers } = await load();
    expect(account).toEqual({ state: "signed-out" });
    expect(headers.get("Set-Cookie")).toBeNull();
  });

  it("is the /v1/me profile for a session", async () => {
    expect((await load(await contributor())).account).toEqual({
      state: "signed-in",
      user: {
        id: "fixture|contributor",
        display_name: "Morwen of the Marches",
        role: "contributor",
      },
    });
  });

  it("says the profile is unavailable when /v1/me fails, and doesn't throw", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fixtures.server.use(
      http.get(`${API_BASE_URL}/v1/me`, () =>
        HttpResponse.json({ code: "internal", message: "x" }, { status: 500 })
      )
    );
    expect((await load(await contributor())).account).toEqual({
      state: "profile-unavailable",
    });
  });

  it("reads as signed out when the API rejects the session, and clears it", async () => {
    const { account, headers } = await load(
      await sessionCookie(sessionTokens({ accessToken: "not-a-fixture-token" }))
    );
    expect(account).toEqual({ state: "signed-out" });
    expect(headers.get("Set-Cookie")).toMatch(
      /^__Host-bt_session=;.*Expires=Thu, 01 Jan 1970/
    );
  });
});
