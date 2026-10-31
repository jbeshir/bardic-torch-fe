import { describe, expect, it, vi } from "vitest";
import {
  APP_ORIGIN,
  loadContext,
  sessionCookie,
  sessionUser,
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
  sessionCookie(sessionUser({ accessToken: "fixture:contributor" }));

describe("loadAccount", () => {
  it("is signed out without a session, and calls nothing", async () => {
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
    fixtures.state().failures.set("contributor:getMe", {
      status: 500,
      code: "internal",
      remaining: 1,
    });
    expect((await load(await contributor())).account).toEqual({
      state: "profile-unavailable",
    });
  });

  it("gives a blocked account the app's message", async () => {
    const me = fixtures.state().users.get("contributor");
    if (me) me.blocked = true;
    const { account } = await load(await contributor());
    expect(account).toMatchObject({ state: "blocked" });
    expect(account.state === "blocked" && account.message).toMatch(
      /^Your account is blocked/
    );
  });

  it("reads as signed out when the API rejects the session, and clears it", async () => {
    const { account, headers } = await load(
      await sessionCookie(sessionUser({ accessToken: "not-a-fixture-token" }))
    );
    expect(account).toEqual({ state: "signed-out" });
    expect(headers.get("Set-Cookie")).toMatch(
      /^__Host-bt_session=;.*Expires=Thu, 01 Jan 1970/
    );
  });

  it("clears an expired session it can't refresh, without calling the API", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { account, headers } = await load(
      await sessionCookie({
        id: "auth0|1",
        email: "bard@example.test",
        accessToken: "access-token",
        expiresAt: Date.now() - 1000,
      })
    );
    expect(account).toEqual({ state: "signed-out" });
    expect(headers.get("Set-Cookie")).toMatch(/__Host-bt_session=/);
  });
});
