import { describe, expect, it, vi } from "vitest";
import { sessionCookie, sessionTokens } from "~/test/context";
import { serveFixtureApi } from "~/test/msw";
import { serveApp } from "~/test/server-build";
import { shouldRevalidate } from "./root";
import { data } from "react-router";
import { routeData } from "~/test/single-fetch";
import * as indexModule from "./routes/_index";
import * as notFoundModule from "./routes/$";

const fixtures = serveFixtureApi();
const failing = {
  loader: () => {
    throw new Error("The page broke");
  },
  default: () => null,
};
const gone = {
  loader: () => {
    throw data(null, { status: 404 });
  },
  default: () => null,
};
const resting = {
  loader: () => {
    throw data({ kind: "resting" }, { status: 503 });
  },
  default: () => null,
};

const get = serveApp([
  { id: "routes/_index", index: true, module: indexModule, hasLoader: false },
  { id: "routes/broken", path: "broken", module: failing, hasLoader: true },
  { id: "routes/gone", path: "gone/:slug", module: gone, hasLoader: true },
  { id: "routes/resting", path: "resting", module: resting, hasLoader: true },
  { id: "routes/$", path: "*", module: notFoundModule, hasLoader: true },
]);

const contributor = () =>
  sessionCookie(sessionTokens({ accessToken: "fixture:contributor" }));

async function rootData(cookie?: string) {
  const response = await get("/_.data?_routes=root", cookie);
  const loaded = (await routeData(response.clone(), "root")) as {
    account: unknown;
  };
  return { response, data: loaded };
}

describe("root loader", () => {
  it("is signed out without a session", async () => {
    expect((await rootData()).data.account).toEqual({ state: "signed-out" });
  });

  it("loads the profile for the account control", async () => {
    expect((await rootData(await contributor())).data.account).toEqual({
      state: "signed-in",
      user: {
        id: "fixture|contributor",
        display_name: "Morwen of the Marches",
        role: "contributor",
      },
    });
  });

  it("still renders the page when /v1/me fails, with the account control saying so", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fixtures.fail({
      userId: "contributor",
      operationId: "getMe",
      status: 500,
      code: "internal",
      times: 2,
    });
    const { response, data } = await rootData(await contributor());
    expect(response.status).toBe(200);
    expect(data.account).toEqual({ state: "profile-unavailable" });

    const page = await get("/", await contributor());
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("We couldn’t load your profile.");
    expect(html).toContain("<h1");
  });

  it("forwards the cleared session when the API rejects it", async () => {
    const { response, data } = await rootData(
      await sessionCookie(sessionTokens({ accessToken: "stale" }))
    );
    expect(data.account).toEqual({ state: "signed-out" });
    expect(response.headers.get("Set-Cookie")).toMatch(/^__Host-bt_session=;/);
  });
});

describe("root shouldRevalidate", () => {
  const url = (path: string) => new URL(`https://app.test${path}`);
  const args = (
    overrides: Partial<Parameters<typeof shouldRevalidate>[0]>
  ): Parameters<typeof shouldRevalidate>[0] => ({
    currentUrl: url("/help"),
    currentParams: {},
    nextUrl: url("/help/licence"),
    nextParams: {},
    defaultShouldRevalidate: true,
    ...overrides,
  });

  const settings = (intent: string, actionResult: unknown) => {
    const formData = new FormData();
    formData.set("intent", intent);
    return args({
      formMethod: "POST",
      formAction: "/settings",
      formData,
      actionResult,
      currentUrl: url("/settings"),
      nextUrl: url("/settings"),
    });
  };
  const saved = { ok: true, data: {} };
  const failure = (code: string) => ({ ok: false, error: { code } });

  it.each([
    ["a plain navigation", args({}), false],
    ["a saved display name", settings("update-profile", saved), true],
    [
      "a failed display name",
      settings("update-profile", failure("invalid_request")),
      false,
    ],
    [
      "a settings call that found the session ended",
      settings("update-profile", failure("unauthenticated")),
      true,
    ],
    [
      "logging out",
      args({ formMethod: "POST", formAction: "/auth/logout" }),
      true,
    ],
    ["going into /auth", args({ nextUrl: url("/auth/login") }), true],
    [
      "coming out of /auth",
      args({ currentUrl: url("/auth/callback?code=x") }),
      true,
    ],
    [
      "another submission",
      args({ formMethod: "POST", formAction: "/elsewhere" }),
      false,
    ],
    ["Try again on the same page", args({ nextUrl: url("/help") }), true],
  ])("%s: %s", (_case, given, expected) => {
    expect(shouldRevalidate(given)).toBe(expected);
  });
});

describe("root error boundary", () => {
  it("shows a standalone error page for anything unexpected, with a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await get("/broken");
    expect(response.status).toBe(500);
    const html = await response.text();
    expect(html).toContain("Something went wrong");
    expect(html).toContain("Try again");
    expect(html).not.toContain("The page broke");
    expect(html).not.toContain('id="site-nav"');
    expect(html).toContain('<main id="content"');
    expect(html).toMatch(/<a href="\/"[^>]*>.*Bardic/);
    expect(html).toContain(
      "<title>Something went wrong · Bardic Torch</title>"
    );
    expect(html).toMatch(/<meta name="robots" content="noindex"\/?>/);
  });

  it("shows the resting page for an API outage, with a 503, kept out of search results", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await get("/resting");
    expect(response.status).toBe(503);
    const html = await response.text();
    expect(html).toContain("Bardic Torch is resting");
    expect(html).toContain("briefly unreachable");
    expect(html).not.toContain("Something went wrong");
    expect(html).toContain('<main id="content"');
    expect(html).toContain(
      "<title>Bardic Torch is resting · Bardic Torch</title>"
    );
    expect(html).toMatch(/<meta name="robots" content="noindex"\/?>/);
    // Try again reloads the page without JS.
    expect(html).toMatch(/<a[^>]*href="\/resting"[^>]*>.*Try again/);
  });
});
