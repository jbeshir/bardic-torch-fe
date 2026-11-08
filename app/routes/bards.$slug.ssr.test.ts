import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  API_BASE_URL,
  routeArgs,
  sessionCookie,
  sessionTokens,
} from "~/test/context";
import { contractResponse, offContractResponse } from "~/test/contract";
import { serveFixtureApi } from "~/test/msw";
import { serveApp } from "~/test/server-build";
import { singleFetchResults } from "~/test/single-fetch";
import * as layoutModule from "./bards.$slug";
import * as readModule from "./bards.$slug._index";

// /bards/:slug against the fixture API through msw: the layout's loader
// (the slug check before any call, every getPerson failure), and the
// documents the real server entry and root make of it.

const fixtures = serveFixtureApi();
const LAYOUT = "routes/bards.$slug";
const READ = "routes/bards.$slug._index";
const get = serveApp([
  {
    id: LAYOUT,
    path: "bards/:slug",
    module: layoutModule,
    hasLoader: true,
    hasErrorBoundary: true,
  },
  {
    id: READ,
    parentId: LAYOUT,
    index: true,
    module: readModule,
    hasLoader: false,
  },
]);

const PERSON = `${API_BASE_URL}/v1/persons/:slug`;

afterEach(() => {
  vi.restoreAllMocks();
});

function quietErrors() {
  return vi.spyOn(console, "error").mockImplementation(() => undefined);
}

const signedIn = () =>
  sessionCookie(sessionTokens({ accessToken: "fixture:contributor" }));

function upstreamRequests() {
  const seen: string[] = [];
  fixtures.server.events.on("request:start", ({ request }) => {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/v1/persons/")) seen.push(pathname);
  });
  return seen;
}

async function load(slug: string): Promise<unknown> {
  try {
    return await layoutModule.loader(
      routeArgs(
        new Request(`https://app.test/bards/${encodeURIComponent(slug)}`),
        { pattern: "/bards/:slug", params: { slug } }
      )
    );
  } catch (thrown) {
    return thrown;
  }
}

async function outage(slug: string) {
  const response = await fetch(`${API_BASE_URL}/__fixtures/outage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      operationId: "getPerson",
      match: { slug },
      mode: "503",
    }),
  });
  expect(response.ok).toBe(true);
}

function mainOf(html: string): string {
  return html.slice(
    html.indexOf('<main id="content"'),
    html.indexOf("</main>")
  );
}

describe("/bards/:slug loader", () => {
  it("loads the person, their Markdown parsed into trees", async () => {
    expect(await load("wren-of-the-vale")).toMatchObject({
      person: { slug: "wren-of-the-vale", name: "Wren of the Vale" },
      markdown: {
        notes: [{ type: "paragraph" }, { type: "list" }],
        licensingNotes: [{ type: "paragraph" }],
      },
    });
  });

  it("has no trees for a person with no page", async () => {
    expect(await load("hollis-fenn")).toMatchObject({
      person: { profile: null },
      markdown: { notes: null, licensingNotes: null },
    });
  });

  it.each(["Wren", "a--b", "a".repeat(192), "a/b", ""])(
    "answers the slug %j 404 without asking the API",
    async slug => {
      const seen = upstreamRequests();
      expect(await load(slug)).toMatchObject({
        data: { kind: "not_found" },
        init: { status: 404 },
      });
      expect(seen).toHaveLength(0);
    }
  );

  it("answers an unknown person 404, and the API's 400 too", async () => {
    quietErrors();
    expect(await load("no-such-bard")).toMatchObject({
      data: { kind: "not_found" },
      init: { status: 404 },
    });
    fixtures.server.use(
      http.get(PERSON, () =>
        contractResponse("getPerson", 400, {
          code: "invalid_request",
          message: "invalid slug",
        })
      )
    );
    expect(await load("wren-of-the-vale")).toMatchObject({
      init: { status: 404 },
    });
  });

  it("throws server (500), resting (503) and bad_gateway (502)", async () => {
    quietErrors();
    fixtures.fail({ operationId: "getPerson", status: 500, code: "internal" });
    expect(await load("wren-of-the-vale")).toMatchObject({
      data: { kind: "server" },
      init: { status: 500 },
    });
    await outage("aldith-of-ashdown");
    expect(await load("aldith-of-ashdown")).toMatchObject({
      data: { kind: "resting", retryAfter: 60 },
      init: { status: 503 },
    });
    fixtures.server.use(http.get(PERSON, () => HttpResponse.error()));
    expect(await load("jorund-skald")).toMatchObject({
      data: { kind: "resting", retryAfter: 30 },
    });
  });

  it("throws bad_gateway (502) for a malformed body, or a profile for a person with no page", async () => {
    quietErrors();
    fixtures.server.use(
      http.get(PERSON, () =>
        offContractResponse("getPerson", 200, { slug: "x" }, "no fields")
      )
    );
    expect(await load("wren-of-the-vale")).toMatchObject({
      data: { kind: "bad_gateway" },
      init: { status: 502 },
    });
    fixtures.server.resetHandlers();
    const wren = (await (
      await fetch(`${API_BASE_URL}/v1/persons/wren-of-the-vale`)
    ).json()) as Record<string, unknown>;
    fixtures.server.use(
      // The spec's schema allows it; its words don't.
      http.get(PERSON, () =>
        contractResponse("getPerson", 200, {
          ...wren,
          status: "prefers_no_page",
        })
      )
    );
    expect(await load("wren-of-the-vale")).toMatchObject({
      data: { kind: "bad_gateway" },
    });
  });
});

describe("/bards/:slug document", () => {
  it("is the bard, titled, canonical and described for search engines", async () => {
    const response = await get("/bards/wren-of-the-vale");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("<title>Wren of the Vale · Bardic Torch</title>");
    expect(html).toMatch(
      /<link rel="canonical" href="https:\/\/app\.test\/bards\/wren-of-the-vale"\/?>/
    );
    expect(html).toContain('<meta property="og:type" content="profile"/>');
    expect(html).not.toContain('name="robots"');
    const ld = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(
      html
    )?.[1];
    expect(JSON.parse(ld ?? "null")).toEqual({
      "@context": "https://schema.org",
      "@type": "Person",
      name: "Wren of the Vale",
      alternateName: ["Wren Vale-Singer", "The Vale Sparrow"],
      url: "https://app.test/bards/wren-of-the-vale",
      sameAs: ["https://wren-vale.example/", "https://profiles.example/wren"],
    });
    const main = mainOf(html);
    expect(main).toMatch(/<h1[^>]*>Wren of the Vale<\/h1>/);
    expect(main).toContain("Community bard · she/her");
    expect(main).toContain('href="/bards/wren-of-the-vale/history"');
    expect(main).not.toContain("HIDDEN-");
  });

  it("names a restricted piece's performance, never its recording", async () => {
    const html = await (await get("/bards/wren-of-the-vale")).text();
    const main = mainOf(html);
    expect(main).toContain('href="/pieces/the-dragons-hoard"');
    expect(main).toContain("Link not shown: see the piece page");
    // Not in the page, nor in the data it hydrates from.
    expect(html).not.toContain("private-recordings.example");
    expect(html).not.toContain("The Dragon’s Hoard, live");
  });

  it("is a group's MusicGroup, disbanded", async () => {
    const html = await (await get("/bards/the-greywater-minstrels")).text();
    expect(html).toContain('"@type":"MusicGroup"');
    expect(mainOf(html)).toContain("Group · Disbanded 1 Sep 2019");
  });

  it("is a no-page person's identity only, kept out of search results", async () => {
    const response = await get("/bards/hollis-fenn");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('<meta name="robots" content="noindex, nofollow"/>');
    expect(html).not.toContain("application/ld+json");
    const main = mainOf(html);
    expect(main).toMatch(/<h1[^>]*>Hollis Fenn<\/h1>/);
    expect(main).toContain("Hollis Fenn has asked not to have a page here.");
    expect(main).toContain('href="https://requests.example/statements/12"');
    expect(main).not.toContain("/bards/hollis-fenn/history");
    expect(main).toMatch(/original Bardic Torch wiki(<!-- -->)?\.<\/p>/);
  });

  it("is our own 404 for a slug that can't be one, without asking the API", async () => {
    const seen = upstreamRequests();
    const response = await get("/bards/Not_A_Slug");
    expect(response.status).toBe(404);
    const html = await response.text();
    expect(html).toContain(
      "<title>We couldn’t find that bard · Bardic Torch</title>"
    );
    expect(seen).toHaveLength(0);
  });

  it("is the server error (500) inside the shell", async () => {
    quietErrors();
    fixtures.fail({ operationId: "getPerson", status: 500, code: "internal" });
    const response = await get("/bards/wren-of-the-vale");
    expect(response.status).toBe(500);
    expect(mainOf(await response.text())).toMatch(
      /<h1[^>]*>We couldn’t load this bard<\/h1>/
    );
  });

  it.each([
    ["signed out", undefined, "private, no-cache"],
    ["signed in", "in", "no-store"],
  ])(
    "is the resting page (503) for an outage, with Retry-After, %s",
    async (_who, who, cacheControl) => {
      quietErrors();
      await outage("dafydd-pennar");
      const response = await get(
        "/bards/dafydd-pennar",
        who ? await signedIn() : undefined
      );
      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBe("60");
      expect(response.headers.get("Cache-Control")).toBe(cacheControl);
      expect(await response.text()).toContain(
        "<title>Bardic Torch is resting · Bardic Torch</title>"
      );
    }
  );

  it("answers a .data request, the resting failure with Retry-After", async () => {
    quietErrors();
    await outage("wynne-of-caer-wyn");
    const response = await get(
      `/bards/wynne-of-caer-wyn.data?${new URLSearchParams([
        ["_routes", `root,${LAYOUT},${READ}`],
      ])}`
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
    const results = await singleFetchResults(response);
    expect(results[LAYOUT]).toMatchObject({
      error: { status: 503, data: { kind: "resting" } },
    });
  });
});
