import { describe, expect, it, vi } from "vitest";
import { sessionCookie, sessionUser } from "~/test/context";
import { serveFixtureApi } from "~/test/msw";
import { serveApp } from "~/test/server-build";
import { shouldRevalidate } from "./root";
import { json } from "@remix-run/cloudflare";
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
    throw json(null, { status: 404 });
  },
  default: () => null,
};

const get = serveApp([
  { id: "routes/_index", index: true, module: indexModule, hasLoader: false },
  { id: "routes/broken", path: "broken", module: failing, hasLoader: true },
  { id: "routes/gone", path: "gone/:slug", module: gone, hasLoader: true },
  { id: "routes/$", path: "*", module: notFoundModule, hasLoader: true },
]);

/** The HelpLinks list in a page. */
function helpLinks(html: string): string {
  return (
    /<ul role="list" aria-label="Help"[\s\S]*?<\/ul>/.exec(html)?.[0] ?? ""
  );
}

const contributor = () =>
  sessionCookie(sessionUser({ accessToken: "fixture:contributor" }));

async function rootData(cookie?: string) {
  const response = await get("/?_data=root", cookie);
  return { response, data: (await response.json()) as { account: unknown } };
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
    fixtures.state().failures.set("contributor:getMe", {
      status: 500,
      code: "internal",
      remaining: 2,
    });
    const { response, data } = await rootData(await contributor());
    expect(response.status).toBe(200);
    expect(data.account).toEqual({ state: "profile-unavailable" });

    const page = await get("/", await contributor());
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("We couldn&#x27;t load your profile.");
    expect(html).toContain("<h1");
  });

  it("tells a blocked account so", async () => {
    const me = fixtures.state().users.get("contributor");
    if (me) me.blocked = true;
    const html = await (await get("/", await contributor())).text();
    expect(html).toMatch(/Your account is blocked/);
  });

  it("forwards the cleared session when the API rejects it", async () => {
    const { response, data } = await rootData(
      await sessionCookie(sessionUser({ accessToken: "stale" }))
    );
    expect(data.account).toEqual({ state: "signed-out" });
    expect(response.headers.get("Set-Cookie")).toMatch(/^__Host-bt_session=;/);
  });

  it("renders the signed-in account control as a disclosure that works without JS", async () => {
    const html = await (await get("/", await contributor())).text();
    expect(html.match(/<details/g)).toHaveLength(2);
    expect(html).toMatch(/Account(<!-- -->)?: Morwen of the Marches/);
    expect(html).toMatch(/<form method="post" action="\/auth\/logout"[^>]*>/);
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

  it("keeps the data on plain navigations", () => {
    expect(shouldRevalidate(args({}))).toBe(false);
  });

  it("reloads after a display-name change", () => {
    expect(
      shouldRevalidate(
        args({
          formMethod: "PATCH",
          formAction: "/api/me",
          nextUrl: url("/help"),
        })
      )
    ).toBe(true);
  });

  it("reloads after logging out", () => {
    expect(
      shouldRevalidate(args({ formMethod: "POST", formAction: "/auth/logout" }))
    ).toBe(true);
  });

  it("reloads on the way into or out of /auth", () => {
    expect(shouldRevalidate(args({ nextUrl: url("/auth/login") }))).toBe(true);
    expect(
      shouldRevalidate(args({ currentUrl: url("/auth/callback?code=x") }))
    ).toBe(true);
  });

  it("keeps the data for other submissions, the theme and tokens included", () => {
    for (const [formMethod, formAction] of [
      ["POST", "/resources/theme"],
      ["POST", "/api/tokens"],
      ["DELETE", "/api/tokens/abc"],
    ] as const) {
      expect(shouldRevalidate(args({ formMethod, formAction }))).toBe(false);
    }
  });

  it("reloads when asked to on the same page (Try again)", () => {
    expect(shouldRevalidate(args({ nextUrl: url("/help") }))).toBe(true);
    expect(
      shouldRevalidate(
        args({ nextUrl: url("/help"), defaultShouldRevalidate: false })
      )
    ).toBe(false);
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

  it("shows the 404 body for a 404 thrown by a loader", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await get("/gone/old-page");
    expect(response.status).toBe(404);
    const html = await response.text();
    expect(html).toContain("We couldn&#x27;t find that page");
    expect(html).toContain("index.php?search=old+page");
    expect(html).toContain("<title>Page not found · Bardic Torch</title>");
  });

  it("has the same help links, in the same order, as every other page (WCAG 3.2.6)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const home = helpLinks(await (await get("/")).text());
    expect(home).toContain("Licence &amp; attribution");
    for (const path of ["/no-such-page", "/broken", "/gone/x"]) {
      expect(helpLinks(await (await get(path)).text()), path).toBe(home);
    }
  });
});
