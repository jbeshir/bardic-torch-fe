import { describe, expect, it, vi } from "vitest";
import { sessionCookie, sessionTokens } from "~/test/context";
import { serveFixtureApi } from "~/test/msw";
import { serveApp } from "~/test/server-build";
import { shouldRevalidate } from "./root";
import { data } from "react-router";
import stylesheetUrl from "../test/support/stylesheet-url";
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

/** The HelpLinks list in a page. */
function helpLinks(html: string): string {
  return (
    /<ul role="list" aria-label="Help"[\s\S]*?<\/ul>/.exec(html)?.[0] ?? ""
  );
}

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
  it("gives the site's origin, from the request, for canonical links", async () => {
    const loaded = (await rootData()).data as unknown as {
      siteOrigin: unknown;
    };
    expect(loaded.siteOrigin).toBe("https://app.test");
  });

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

  it("tells a blocked account so", async () => {
    const me = fixtures.state().users.get("contributor");
    if (me) me.blocked = true;
    const html = await (await get("/", await contributor())).text();
    expect(html).toMatch(/Your account is blocked/);
  });

  it("forwards the cleared session when the API rejects it", async () => {
    const { response, data } = await rootData(
      await sessionCookie(sessionTokens({ accessToken: "stale" }))
    );
    expect(data.account).toEqual({ state: "signed-out" });
    expect(response.headers.get("Set-Cookie")).toMatch(/^__Host-bt_session=;/);
  });

  it("renders the signed-in account control as a disclosure that works without JS", async () => {
    const html = await (await get("/", await contributor())).text();
    expect(html.match(/<details/g)).toHaveLength(2);
    expect(html).toMatch(/Account(<!-- -->)?: Morwen of the Marches/);
    // React Router 8 writes `action` before `method`; the order is no matter.
    expect(html).toMatch(
      /<form(?=[^>]* method="post")(?=[^>]* action="\/auth\/logout")[^>]*>/
    );
  });
});

describe("root document", () => {
  it("links a stylesheet with a non-empty href", async () => {
    const html = await (await get("/")).text();
    const hrefs = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)].map(
      link => /href="([^"]*)"/.exec(link[0])?.[1]
    );
    // vitest.config.ts aliases `~/styles/app.css?url` to this stub.
    expect(hrefs).toContain(stylesheetUrl);
    for (const href of hrefs) expect(href).toBeTruthy();
  });

  it("gives the home page its canonical address and link-preview tags", async () => {
    const html = await (await get("/?utm_source=x")).text();
    expect(html).toContain("<title>Bardic Torch</title>");
    expect(html).toMatch(
      /<link rel="canonical" href="https:\/\/app\.test\/"\/?>/
    );
    expect(html).toContain(
      '<meta property="og:url" content="https://app.test/"'
    );
    expect(html).toContain(
      '<meta property="og:site_name" content="Bardic Torch"'
    );
    expect(html).toContain('<meta property="og:locale" content="en_GB"');
    expect(html).toContain('<meta name="twitter:card" content="summary"');
    expect(html).not.toContain('name="robots"');
  });
});

describe("root headers", () => {
  it("send the loader's no-store on while signed in, to documents and .data answers, its own route's and its children's", async () => {
    const cacheControl = async (path: string, cookie?: string) =>
      (await get(path, cookie)).headers.get("Cache-Control");
    const signedIn = await contributor();
    // The home page and the 404 route have no `headers` export of their own.
    for (const path of ["/", "/_.data", "/nowhere", "/nowhere.data"]) {
      expect(await cacheControl(path, signedIn), path).toBe("no-store");
      expect(await cacheControl(path), path).toBe("private, no-cache");
    }
    // A .data answer without the root's loader has none of its headers.
    expect(
      await cacheControl("/nowhere.data?_routes=routes%2F%24", signedIn)
    ).toBe("private, no-cache");
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

  /** A settings form submission (to the settings route's clientAction). */
  const settingsForm = (
    intent: string,
    actionResult: unknown
  ): Partial<Parameters<typeof shouldRevalidate>[0]> => ({
    formMethod: "POST",
    formAction: "/settings",
    formData: (() => {
      const form = new FormData();
      form.set("intent", intent);
      return form;
    })(),
    actionResult,
    currentUrl: url("/settings"),
    nextUrl: url("/settings"),
  });
  const failure = (code: string) => ({
    ok: false,
    error: { code, message: "" },
  });

  it("reloads after a display-name change was saved", () => {
    expect(
      shouldRevalidate(
        args(settingsForm("update-profile", { ok: true, data: {} }))
      )
    ).toBe(true);
  });

  it.each(["invalid_request", "offline", "unexpected_response", "internal"])(
    "keeps the data when a display-name change failed (%s)",
    code => {
      expect(
        shouldRevalidate(args(settingsForm("update-profile", failure(code))))
      ).toBe(false);
    }
  );

  it.each(["update-profile", "create-token", "revoke-token"])(
    "reloads when a settings call (%s) found the session ended, so the header shows Log in",
    intent => {
      expect(
        shouldRevalidate(args(settingsForm(intent, failure("unauthenticated"))))
      ).toBe(true);
    }
  );

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

  it("keeps the data for other submissions, tokens included", () => {
    for (const intent of ["create-token", "revoke-token"]) {
      expect(
        shouldRevalidate(args(settingsForm(intent, { ok: true, data: null })))
      ).toBe(false);
    }
    expect(
      shouldRevalidate(args({ formMethod: "POST", formAction: "/elsewhere" }))
    ).toBe(false);
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
    expect(html).toContain("We couldn’t find that page");
    expect(html).toContain("index.php?search=old+page");
    expect(html).toContain("<title>Page not found · Bardic Torch</title>");
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

  it("has the same help links, in the same order, as every other page (WCAG 3.2.6)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const home = helpLinks(await (await get("/")).text());
    expect(home).toContain("Licence &amp; attribution");
    for (const path of ["/no-such-page", "/broken", "/gone/x", "/resting"]) {
      expect(helpLinks(await (await get(path)).text()), path).toBe(home);
    }
  });
});
