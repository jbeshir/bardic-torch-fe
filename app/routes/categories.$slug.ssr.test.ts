import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, routeArgs } from "~/test/context";
import { contractResponse } from "~/test/contract";
import { serveFixtureApi } from "~/test/msw";
import { serveApp } from "~/test/server-build";
import * as layoutModule from "./categories.$slug";
import * as membersModule from "./categories.$slug._index";

// /categories/:slug against the fixture API through msw: the layout's head
// read and the Read child's members read, the slug check before any call,
// member paging and its redirects, every failure, and the documents.

const fixtures = serveFixtureApi();
const LAYOUT = "routes/categories.$slug";
const MEMBERS = "routes/categories.$slug._index";
const get = serveApp([
  {
    id: LAYOUT,
    path: "categories/:slug",
    module: layoutModule,
    hasLoader: true,
    hasErrorBoundary: true,
  },
  {
    id: MEMBERS,
    parentId: LAYOUT,
    index: true,
    module: membersModule,
    hasLoader: true,
    hasErrorBoundary: true,
  },
]);

afterEach(() => {
  vi.restoreAllMocks();
});

function quietErrors() {
  return vi.spyOn(console, "error").mockImplementation(() => undefined);
}

/** Every getTerm request, as "path?query". */
function termRequests() {
  const seen: string[] = [];
  fixtures.server.events.on("request:start", ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/v1/terms/")) {
      seen.push(`${url.pathname}${url.search}`);
    }
  });
  return seen;
}

async function run(
  module: typeof layoutModule | typeof membersModule,
  path: string
): Promise<unknown> {
  const url = new URL(`https://app.test${path}`);
  try {
    return await module.loader(
      routeArgs(new Request(url), {
        params: { slug: decodeURIComponent(url.pathname.split("/")[2] ?? "") },
      })
    );
  } catch (thrown) {
    return thrown;
  }
}

function mainOf(html: string): string {
  return html.slice(
    html.indexOf('<main id="content"'),
    html.indexOf("</main>")
  );
}

describe("/categories/:slug loaders", () => {
  it("reads the head with one member, and the members a page at a time", async () => {
    const seen = termRequests();
    expect(await run(layoutModule, "/categories/swords")).toMatchObject({
      term: {
        slug: "swords",
        ancestors: [{ slug: "war" }, { slug: "battles" }],
      },
    });
    expect(await run(membersModule, "/categories/joyful?page=2")).toMatchObject(
      { state: { page: 2 }, term: { piece_count: 215 } }
    );
    expect(seen).toEqual([
      "/v1/terms/swords?limit=1",
      "/v1/terms/joyful?limit=50&offset=50",
    ]);
  });

  it.each(["Swords", "a%2Fb", "swords-", "..", "a--b"])(
    "is our own 404 for %s, with no call",
    async slug => {
      const seen = termRequests();
      for (const module of [layoutModule, membersModule]) {
        expect(await run(module, `/categories/${slug}`)).toMatchObject({
          data: { kind: "not_found" },
          init: { status: 404 },
        });
      }
      expect(seen).toEqual([]);
    }
  );

  it("is a 404 for a term the API doesn't know", async () => {
    quietErrors();
    expect(await run(layoutModule, "/categories/no-such-term")).toMatchObject({
      data: { kind: "not_found" },
      init: { status: 404 },
    });
  });

  it.each([
    ["page 1", "?page=1", "/categories/joyful"],
    ["an unknown parameter", "?limit=5", "/categories/joyful"],
  ])("redirects %s with one 301", async (_why, search, location) => {
    const answer = await run(membersModule, `/categories/joyful${search}`);
    expect(answer).toBeInstanceOf(Response);
    expect((answer as Response).status).toBe(301);
    expect((answer as Response).headers.get("Location")).toBe(location);
  });

  it.each([
    [
      "past the last page",
      "/categories/joyful?page=9",
      "/categories/joyful?page=5",
    ],
    ["of a short list", "/categories/swords?page=2", "/categories/swords"],
    [
      "of an empty list",
      "/categories/miscellany?page=2",
      "/categories/miscellany",
    ],
  ])("sends a page %s with one 302", async (_why, path, location) => {
    const answer = await run(membersModule, path);
    expect(answer).toBeInstanceOf(Response);
    expect((answer as Response).status).toBe(302);
    expect((answer as Response).headers.get("Location")).toBe(location);
  });

  it("lists an affiliation's bards", async () => {
    expect(await run(membersModule, "/categories/northmarch")).toMatchObject({
      term: {
        facet: "affiliation",
        person_count: 4,
        persons: expect.arrayContaining([
          expect.objectContaining({ slug: "wren-of-the-vale" }),
        ]),
      },
    });
  });

  it.each([
    [
      "a 500",
      () =>
        contractResponse("getTerm", 500, { code: "internal", message: "x" }),
      { kind: "server" },
      500,
    ],
    [
      "a network failure",
      () => HttpResponse.error(),
      { kind: "resting", retryAfter: 30 },
      503,
    ],
    [
      "a proxy's 503",
      () => new HttpResponse("down", { status: 503 }),
      { kind: "resting", retryAfter: 60 },
      503,
    ],
    [
      "a malformed body",
      () => new HttpResponse("not JSON", { status: 200 }),
      { kind: "bad_gateway" },
      502,
    ],
    [
      "a 400 after our own check",
      () =>
        contractResponse("getTerm", 400, {
          code: "invalid_request",
          message: "x",
        }),
      { kind: "not_found" },
      404,
    ],
  ] as const)(
    "throws %s from both loaders",
    async (_why, respond, failure, status) => {
      quietErrors();
      fixtures.server.use(http.get(`${API_BASE_URL}/v1/terms/swords`, respond));
      for (const module of [layoutModule, membersModule]) {
        expect(await run(module, "/categories/swords")).toMatchObject({
          data: failure,
          init: { status },
        });
      }
    }
  );
});

describe("/categories/:slug document", () => {
  it("is the category: breadcrumbs, head, chips, members and licence", async () => {
    const response = await get("/categories/swords");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("<title>Swords · Bardic Torch</title>");
    expect(html).toMatch(
      /<link rel="canonical" href="https:\/\/app\.test\/categories\/swords"\/?>/
    );
    const main = mainOf(html);
    expect(main).toMatch(/<h1[^>]*>Swords<\/h1>/);
    expect(main).toContain("Topic · 2 pieces");
    expect(main).toContain('href="/categories?facet=topic"');
    expect(main).toContain('href="/categories/battles"');
    expect(main).toContain('href="/pieces/fields-of-thorn"');
    expect(main).toContain('href="/pieces?term=swords"');
    expect(main).toContain('href="/categories/swords/history"');
    expect(main).toMatch(/aria-current="page"[^>]*>.*Swords/);
  });

  it("titles a later page, and names it canonical", async () => {
    const html = await (await get("/categories/joyful?page=2")).text();
    expect(html).toContain("<title>Joyful, page 2 · Bardic Torch</title>");
    expect(html).toMatch(
      /<link rel="canonical" href="https:\/\/app\.test\/categories\/joyful\?page=2"\/?>/
    );
    expect(mainOf(html)).toContain('href="/categories/joyful?page=3"');
  });

  it("is the 404 page for an invalid slug, titled for the category", async () => {
    const response = await get("/categories/Swords");
    expect(response.status).toBe(404);
    const html = await response.text();
    expect(html).toContain(
      "<title>We couldn’t find that category · Bardic Torch</title>"
    );
    expect(html).toContain('<meta name="robots" content="noindex"/>');
    expect(mainOf(html)).toMatch(
      /<h1[^>]*>We couldn’t find that category<\/h1>/
    );
  });

  it("is the resting page (503) with Retry-After for an outage", async () => {
    quietErrors();
    fixtures.server.use(
      http.get(`${API_BASE_URL}/v1/terms/swords`, () => HttpResponse.error())
    );
    const response = await get("/categories/swords");
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache");
  });
});
