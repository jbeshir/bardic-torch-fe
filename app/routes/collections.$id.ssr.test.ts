import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, routeArgs } from "~/test/context";
import { contractResponse, offContractResponse } from "~/test/contract";
import { serveFixtureApi } from "~/test/msw";
import { serveApp } from "~/test/server-build";
import * as layoutModule from "./collections.$id";
import * as readModule from "./collections.$id._index";

// /collections/:id against the fixture API through msw: the id check
// before any call, every failure of getCollection, and the documents.

const fixtures = serveFixtureApi();
const LAYOUT = "routes/collections.$id";
const get = serveApp([
  {
    id: LAYOUT,
    path: "collections/:id",
    module: layoutModule,
    hasLoader: true,
    hasErrorBoundary: true,
  },
  {
    id: "routes/collections.$id._index",
    parentId: LAYOUT,
    index: true,
    module: readModule,
    hasLoader: false,
  },
]);

afterEach(() => {
  vi.restoreAllMocks();
});

function quietErrors() {
  return vi.spyOn(console, "error").mockImplementation(() => undefined);
}

async function load(id: string): Promise<unknown> {
  try {
    return await layoutModule.loader(
      routeArgs(new Request(`https://app.test/collections/${id}`), {
        params: { id },
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

describe("/collections/:id loader", () => {
  it.each([
    "0",
    "01",
    "abc",
    "12345678901234567890",
    "-3",
    "9223372036854775808",
  ])("is our own 404 for %j, with no call", async id => {
    const seen: string[] = [];
    fixtures.server.events.on("request:start", ({ request }) => {
      seen.push(request.url);
    });
    expect(await load(id)).toMatchObject({
      data: { kind: "not_found" },
      init: { status: 404 },
    });
    expect(seen).toEqual([]);
  });

  it("reads the collection", async () => {
    expect(await load("12")).toMatchObject({
      collection: { name: "The Northmarch Songbook", citations_total: 5 },
    });
  });

  it.each([
    [
      "a 404",
      () =>
        contractResponse("getCollection", 404, {
          code: "not_found",
          message: "x",
        }),
      { kind: "not_found" },
      404,
    ],
    [
      "a 400 after our own check",
      () =>
        contractResponse("getCollection", 400, {
          code: "invalid_request",
          message: "x",
        }),
      { kind: "not_found" },
      404,
    ],
    [
      "a 500",
      () =>
        contractResponse("getCollection", 500, {
          code: "internal",
          message: "x",
        }),
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
      () =>
        offContractResponse(
          "getCollection",
          200,
          { id: 12 },
          "a Collection without its fields"
        ),
      { kind: "bad_gateway" },
      502,
    ],
  ] as const)("throws %s", async (_why, respond, failure, status) => {
    quietErrors();
    fixtures.server.use(http.get(`${API_BASE_URL}/v1/collections/12`, respond));
    expect(await load("12")).toMatchObject({ data: failure, init: { status } });
  });
});

describe("/collections/:id document", () => {
  it("is the collection: head, infobox, citations and licence", async () => {
    const response = await get("/collections/12");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain(
      "<title>The Northmarch Songbook · Bardic Torch</title>"
    );
    const main = mainOf(html);
    expect(main).toContain("Songbook website · Northmarch");
    expect(main).toContain('href="/categories/northmarch"');
    expect(main).toContain('href="/collections/13"');
    expect(main).toContain('href="/pieces/the-copper-kettle"');
    expect(main).toContain('href="/collections/12/history"');
    // The restricted piece is named, but its link is never in the page.
    expect(main).toContain('href="/pieces/the-dragons-hoard"');
    expect(main).toContain("Link not shown: see the piece page");
    expect(html).not.toContain("private-recordings.example");
  });

  it("says how many citations are past the cap", async () => {
    const main = mainOf(await (await get("/collections/9")).text());
    expect(main).toContain("and 5 more");
  });

  it("is the 404 page for an invalid id, titled for the collection", async () => {
    const response = await get("/collections/012");
    expect(response.status).toBe(404);
    expect(await response.text()).toContain(
      "<title>We couldn’t find that collection · Bardic Torch</title>"
    );
  });
});
