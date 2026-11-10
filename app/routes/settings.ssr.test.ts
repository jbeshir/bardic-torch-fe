import { describe, expect, it, vi } from "vitest";
import { CONTACT_FORM_URL } from "~/constants/navigation";
import { sessionCookie, sessionTokens } from "~/test/context";
import type { UpstreamErrorCode } from "~/schemas/api";
import { serveFixtureApi } from "~/test/msw";
import { serveApp } from "~/test/server-build";
import { routeData } from "~/test/single-fetch";
import * as settingsModule from "./settings";

// /settings rendered by the real server entry and root, against the fixture
// API through msw: what reaches the browser before any JS runs.

const fixtures = serveFixtureApi();
const get = serveApp([
  {
    id: "routes/settings",
    path: "settings",
    module: settingsModule,
    hasLoader: false,
    hasErrorBoundary: true,
  },
]);

const signedIn = (id = "contributor") =>
  sessionCookie(sessionTokens({ accessToken: `fixture:${id}` }));

function fail(
  operationId: string,
  status: number,
  code: UpstreamErrorCode,
  times = 1
) {
  fixtures.fail({ userId: "contributor", operationId, status, code, times });
}

describe("/settings document", () => {
  it("is never cached and stays out of search results", async () => {
    const response = await get("/settings", await signedIn());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const html = await response.text();
    expect(html).toContain("<title>Settings · Bardic Torch</title>");
    expect(html).toContain('<meta name="robots" content="noindex"/>');
  });

  it("signed out, offers Log in back to /settings and no forms", async () => {
    const response = await get("/settings");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const html = await response.text();
    expect(html).toContain(">Settings</h1>");
    expect(html).toContain("Log in to change your display name.");
    expect(html).toContain('href="/auth/login?returnTo=%2Fsettings"');
    expect(html).not.toContain('name="display_name"');
    expect(html).not.toContain("<noscript>");
  });

  it("signed in, shows the name and the no-JS notice, with the submit buttons waiting for JS", async () => {
    const html = await (await get("/settings", await signedIn())).text();
    expect(html).toContain('value="Morwen of the Marches"');
    expect(html).toContain(
      "Changing your settings needs JavaScript. Everything else on Bardic Torch works without it."
    );
    expect(html).toMatch(
      /<noscript>[\s\S]*needs JavaScript[\s\S]*<\/noscript>/
    );
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?Save changes/);
    expect(html).not.toContain('style="');
  });

  it("keeps the session cookie the API calls refreshed or cleared", async () => {
    fail("getMe", 401, "unauthenticated");
    const response = await get("/settings", await signedIn());
    expect(response.status).toBe(200);
    expect(response.headers.get("Set-Cookie")).toMatch(
      /^__Host-bt_session=;.*Expires=Thu, 01 Jan 1970/
    );
    expect(await response.text()).toContain(
      'href="/auth/login?returnTo=%2Fsettings"'
    );
  });

  it("a blocked account sees why, and no forms", async () => {
    const blocked = fixtures.state().users.get("contributor");
    if (!blocked) throw new Error("no seeded contributor");
    blocked.blocked = true;
    const html = await (await get("/settings", await signedIn())).text();
    expect(html).toMatch(/<h2[^>]*>.*Your account is blocked<\/h2>/);
    expect(html).toContain(
      "You can’t change your settings or suggest edits. If you think this is a mistake,"
    );
    expect(html).toMatch(
      new RegExp(
        `<a [^>]*href="${CONTACT_FORM_URL}"[^>]*>contact the Bardic Torch `
      )
    );
    expect(html).not.toContain('name="display_name"');
    expect(html).not.toContain('name="name"');
  });

  it("when only /v1/me fails, the profile says so", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fail("getMe", 500, "internal");
    const html = await (await get("/settings", await signedIn())).text();
    expect(html).toContain("We couldn’t load your profile.");
    expect(html).not.toContain('name="display_name"');
  });
});

describe("/settings .data answers", () => {
  it.each([
    ["signed in", () => signedIn()],
    ["signed out", async () => undefined],
  ])(
    "a .data request for the route (%s) is never cached",
    async (_case, cookie) => {
      const response = await get(
        "/settings.data?_routes=routes%2Fsettings",
        await cookie()
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  );

  it("the root's .data answer is never cached when signed in, and revalidated when not", async () => {
    const signedInRoot = await get(
      "/settings.data?_routes=root",
      await signedIn()
    );
    expect(signedInRoot.headers.get("Cache-Control")).toBe("no-store");
    expect(await routeData(signedInRoot, "root")).toMatchObject({
      account: { state: "signed-in" },
    });
    // Single fetch gives the answer the page's route headers: on /settings
    // that is the settings route's no-store, so the root's own is asked for
    // at "/", where no route sets one.
    const signedOutRoot = await get("/_.data?_routes=root");
    expect(signedOutRoot.headers.get("Cache-Control")).toBe(
      "private, no-cache"
    );
    expect(await routeData(signedOutRoot, "root")).toMatchObject({
      account: { state: "signed-out" },
    });
    const signedOutSettings = await get("/settings.data?_routes=root");
    expect(signedOutSettings.headers.get("Cache-Control")).toBe("no-store");
  });
});
