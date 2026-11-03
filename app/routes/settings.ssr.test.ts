import { describe, expect, it, vi } from "vitest";
import { CONTACT_FORM_URL } from "~/constants/navigation";
import { sessionCookie, sessionTokens } from "~/test/context";
import type { UpstreamErrorCode } from "~/schemas/api";
import { serveFixtureApi } from "~/test/msw";
import { serveApp } from "~/test/server-build";
import { routeData, singleFetchResults } from "~/test/single-fetch";
import * as settingsModule from "./settings";

// /settings rendered by the real server entry and root, against the fixture
// API through msw: what reaches the browser before any JS runs.

const fixtures = serveFixtureApi();
const get = serveApp([
  {
    id: "routes/settings",
    path: "settings",
    module: settingsModule,
    hasLoader: true,
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
  fixtures.state().failures.set(`contributor:${operationId}`, {
    status,
    code,
    remaining: times,
  });
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
    expect(html).toContain(
      "Log in to change your display name and manage your API tokens."
    );
    expect(html).toContain('href="/auth/login?returnTo=%2Fsettings"');
    expect(html).not.toContain('name="display_name"');
    expect(html).not.toContain("<noscript>");
  });

  it("signed in, shows the name, the tokens and the no-JS notice, with the submit buttons waiting for JS", async () => {
    const html = await (await get("/settings", await signedIn())).text();
    expect(html).toContain('value="Morwen of the Marches"');
    expect(html).toContain(
      "Changing your settings needs JavaScript. Everything else on Bardic Torch works without it."
    );
    expect(html).toMatch(
      /<noscript>[\s\S]*needs JavaScript[\s\S]*<\/noscript>/
    );
    // Newest first, as the API lists them; the unnamed one by its prefix.
    const names = ["Songbook importer", "Token 9c1e7d3b…", "Laptop scripts"];
    const positions = names.map(name => html.indexOf(`>${name}</th>`));
    expect(positions.every(position => position > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html).toContain(
      '<time dateTime="2026-10-01T09:00:00Z">1 Oct 2026</time>'
    );
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?Save changes/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?Create token/);
    expect(html).not.toContain('style="');
  });

  it("keeps the session cookie the API calls refreshed or cleared", async () => {
    fail("listAPITokens", 401, "unauthenticated");
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

  it("when only /v1/me fails, the profile says so and the tokens still load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fail("getMe", 500, "internal");
    const html = await (await get("/settings", await signedIn())).text();
    expect(html).toContain("We couldn’t load your profile.");
    expect(html).not.toContain('name="display_name"');
    expect(html).toContain(">Laptop scripts</th>");
  });

  it("a refused token list (403) is a message in its section, not an error page", async () => {
    fail("listAPITokens", 403, "api_token_not_allowed");
    const response = await get("/settings", await signedIn());
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain(
      "API tokens can’t manage API tokens. Log in on the website to do this."
    );
    expect(html).toContain('value="Morwen of the Marches"');
  });
});

describe("/settings route error boundary", () => {
  it.each([
    [500, "internal"],
    [500, "unavailable"],
  ] as const)(
    "GET /v1/tokens %i %s renders the settings boundary inside the shell",
    async (status, code) => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      fail("listAPITokens", status, code);
      const response = await get("/settings", await signedIn());
      expect(response.status).toBe(500);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      const html = await response.text();
      expect(html).toContain("We couldn’t load your settings");
      expect(html).toContain("Try again");
      expect(html).toContain("Go to the home page");
      // The shell and the root's data are still there.
      expect(html).toContain('id="site-nav"');
      expect(html).toContain("Morwen of the Marches");
      expect(html).toContain('aria-label="Notifications"');
      expect(html).not.toContain("Something went wrong");
    }
  );

  it("when /v1/me fails too, the root degrades and the settings boundary still shows", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fail("listAPITokens", 500, "internal");
    fail("getMe", 500, "internal");
    const response = await get("/settings", await signedIn());
    expect(response.status).toBe(500);
    const html = await response.text();
    expect(html).toContain("We couldn’t load your settings");
    expect(html).toContain("We couldn’t load your profile.");
    expect(html).toContain('id="site-nav"');
  });

  it("a .data request for the route gets the error with no-store", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fail("listAPITokens", 500, "internal");
    const response = await get(
      "/settings.data?_routes=routes%2Fsettings",
      await signedIn()
    );
    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await singleFetchResults(response)).toEqual({
      "routes/settings": {
        error: {
          status: 500,
          // React Router 8 sends the status's reason phrase.
          statusText: "Internal Server Error",
          data: { message: "We couldn’t do that just now. Try again shortly." },
        },
      },
    });
  });

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

  it("an API answer the app can't use is a 502, shown by the same boundary", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fixtures.state().users.get("contributor")?.tokens.push({
      id: "broken",
      prefix: "not-hex!",
      name: null,
      created_at: "2026-10-01T09:00:00Z",
      last_used_at: null,
    });
    const response = await get("/settings", await signedIn());
    expect(response.status).toBe(502);
    expect(await response.text()).toContain("We couldn’t load your settings");
  });
});
