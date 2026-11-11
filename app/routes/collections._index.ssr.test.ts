import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, routeArgs } from "~/test/context";
import { contractResponse } from "~/test/contract";
import { serveFixtureApi } from "~/test/msw";
import { serveApp } from "~/test/server-build";
import * as collectionsModule from "./collections._index";

// /collections against the fixture API through msw: the canonical and
// paging redirects, the kind filter's failures shown by the page and the
// others thrown, and the documents.

const fixtures = serveFixtureApi();
const get = serveApp([
  {
    id: "routes/collections._index",
    path: "collections",
    module: collectionsModule,
    hasLoader: true,
    hasErrorBoundary: true,
  },
]);
const COLLECTIONS = `${API_BASE_URL}/v1/collections`;

afterEach(() => {
  vi.restoreAllMocks();
});

function quietErrors() {
  return vi.spyOn(console, "error").mockImplementation(() => undefined);
}

async function load(search: string): Promise<unknown> {
  try {
    return await collectionsModule.loader(
      routeArgs(new Request(`https://app.test/collections${search}`))
    );
  } catch (thrown) {
    return thrown;
  }
}

async function redirectOf(search: string) {
  const answer = await load(search);
  if (!(answer instanceof Response)) return null;
  return { status: answer.status, location: answer.headers.get("Location") };
}

function mainOf(html: string): string {
  return html.slice(
    html.indexOf('<main id="content"'),
    html.indexOf("</main>")
  );
}

const internal = () =>
  contractResponse("listCollections", 500, { code: "internal", message: "x" });

describe("/collections loader", () => {
  it("keeps the API's order, by sort name, a leading ‘The’ ignored", async () => {
    const answer = (await load("")) as {
      list: { data: { name: string }[] };
    };
    expect(answer.list.data.map(c => c.name).slice(0, 3)).toEqual([
      "2nd Northmarch Songbook",
      "The Ashdown Tune Index",
      "Bardic Resources Wiki",
    ]);
  });

  it.each([
    ["an upper-case kind", "?kind=Wiki", "/collections"],
    ["an unknown kind", "?kind=zine&letter=c", "/collections?letter=C"],
    ["a repeated kind", "?kind=blog&kind=blog", "/collections?kind=blog"],
    ["page 1", "?page=1", "/collections"],
  ])("redirects %s with one 301", async (_why, search, location) => {
    expect(await redirectOf(search)).toEqual({ status: 301, location });
  });

  it.each([["a page past the end", "?page=3", "/collections"]])(
    "sends %s on with one 302",
    async (_why, search, location) => {
      expect(await redirectOf(search)).toEqual({ status: 302, location });
    }
  );

  it("returns search_timeout (500) for a 500 to a kind filter", async () => {
    quietErrors();
    fixtures.server.use(http.get(COLLECTIONS, internal));
    expect(await load("?kind=wiki")).toMatchObject({
      data: { failure: { kind: "search_timeout" }, list: null },
      init: { status: 500 },
    });
  });

  it("throws server (500) for a 500 to a letter or the whole list", async () => {
    quietErrors();
    fixtures.server.use(http.get(COLLECTIONS, internal));
    for (const search of ["", "?letter=T"]) {
      expect(await load(search)).toMatchObject({
        data: { kind: "server" },
        init: { status: 500 },
      });
    }
  });

  it("returns invalid_filters (400) for the API's 400", async () => {
    quietErrors();
    fixtures.server.use(
      http.get(COLLECTIONS, () =>
        contractResponse("listCollections", 400, {
          code: "invalid_request",
          message: "invalid kind",
        })
      )
    );
    expect(await load("?kind=wiki")).toMatchObject({
      data: { failure: { kind: "invalid_filters" } },
      init: { status: 400 },
    });
  });

  it.each([
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
  ] as const)("throws %s", async (_why, respond, failure, status) => {
    quietErrors();
    fixtures.server.use(http.get(COLLECTIONS, respond));
    expect(await load("")).toMatchObject({ data: failure, init: { status } });
  });
});

describe("/collections document", () => {
  it("lists every collection with the A–Z, titled and canonical", async () => {
    const response = await get("/collections");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("<title>Collections · Bardic Torch</title>");
    expect(html).not.toContain('name="robots"');
    const main = mainOf(html);
    expect(main).toContain("14 collections");
    expect(main).toContain('aria-label="Collections by letter"');
    expect(main).toContain('href="/collections/12"');
    expect(main).toContain('rel="nofollow ugc noopener"');
    expect(main).toContain("Made for bards");
  });

  it("keeps a kind filter out of the index", async () => {
    const html = await (await get("/collections?kind=wiki")).text();
    expect(html).toContain('<meta name="robots" content="noindex, follow"/>');
  });

  it("is the slow-search page for a 500 to a kind filter, keeping the filter", async () => {
    quietErrors();
    fixtures.server.use(http.get(COLLECTIONS, internal));
    const response = await get("/collections?kind=wiki");
    expect(response.status).toBe(500);
    const main = mainOf(await response.text());
    expect(main).toMatch(/<h1[^>]*>That search took too long<\/h1>/);
    expect(main).toContain('name="kind"');
  });

  it("is the resting page (503) with Retry-After for an outage", async () => {
    quietErrors();
    fixtures.server.use(http.get(COLLECTIONS, () => HttpResponse.error()));
    const response = await get("/collections");
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache");
  });
});
