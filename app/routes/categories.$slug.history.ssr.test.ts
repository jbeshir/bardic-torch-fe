import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, routeArgs } from "~/test/context";
import { contractResponse, offContractResponse } from "~/test/contract";
import { serveFixtureApi } from "~/test/msw";
import { serveApp } from "~/test/server-build";
import * as layoutModule from "./categories.$slug";
import * as membersModule from "./categories.$slug._index";
import * as historyModule from "./categories.$slug.history";

// /categories/:slug/history against the fixture API through msw: the slug
// check, paging and its redirects, every failure, that it never reads the
// members, and the documents (titled from the layout, noindex).

const fixtures = serveFixtureApi();
const LAYOUT = "routes/categories.$slug";
const get = serveApp([
  {
    id: LAYOUT,
    path: "categories/:slug",
    module: layoutModule,
    hasLoader: true,
    hasErrorBoundary: true,
  },
  {
    id: "routes/categories.$slug._index",
    parentId: LAYOUT,
    index: true,
    module: membersModule,
    hasLoader: true,
    hasErrorBoundary: true,
  },
  {
    id: "routes/categories.$slug.history",
    parentId: LAYOUT,
    path: "history",
    module: historyModule,
    hasLoader: true,
    hasErrorBoundary: true,
  },
]);
const HISTORY = `${API_BASE_URL}/v1/terms/war/history`;

afterEach(() => {
  vi.restoreAllMocks();
});

function quietErrors() {
  return vi.spyOn(console, "error").mockImplementation(() => undefined);
}

function requests() {
  const seen: string[] = [];
  fixtures.server.events.on("request:start", ({ request }) => {
    const url = new URL(request.url);
    seen.push(`${url.pathname}${url.search}`);
  });
  return seen;
}

async function load(slug: string, search = ""): Promise<unknown> {
  try {
    return await historyModule.loader(
      routeArgs(
        new Request(`https://app.test/categories/${slug}/history${search}`),
        { params: { slug } }
      )
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

describe("/categories/:slug/history loader", () => {
  it("reads one page of the history, newest first", async () => {
    expect(await load("war")).toMatchObject({
      state: { page: 1 },
      history: { total: 2, data: [{ id: 1009 }, { id: 1008 }] },
    });
  });

  it("is our own 404 for an invalid slug, with no call", async () => {
    const seen = requests();
    expect(await load("War")).toMatchObject({
      data: { kind: "not_found" },
      init: { status: 404 },
    });
    expect(seen).toEqual([]);
  });

  it.each([
    ["page 1", "?page=1", 301, "/categories/war/history"],
    ["past the end", "?page=2", 302, "/categories/war/history"],
    ["past the API", "?page=900", 302, "/categories/war/history"],
  ])("redirects %s", async (_why, search, status, location) => {
    const answer = await load("war", search);
    expect(answer).toBeInstanceOf(Response);
    expect((answer as Response).status).toBe(status);
    expect((answer as Response).headers.get("Location")).toBe(location);
  });

  it.each([
    [
      "a 404",
      () =>
        contractResponse("listTermRevisions", 404, {
          code: "not_found",
          message: "x",
        }),
      { kind: "not_found" },
      404,
    ],
    [
      "a 400 after our own check",
      () =>
        contractResponse("listTermRevisions", 400, {
          code: "invalid_request",
          message: "x",
        }),
      { kind: "not_found" },
      404,
    ],
    [
      "a 500",
      () =>
        contractResponse("listTermRevisions", 500, {
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
        offContractResponse("listTermRevisions", 200, { data: [] }, "no total"),
      { kind: "bad_gateway" },
      502,
    ],
  ] as const)("throws %s", async (_why, respond, failure, status) => {
    quietErrors();
    fixtures.server.use(http.get(HISTORY, respond));
    expect(await load("war")).toMatchObject({
      data: failure,
      init: { status },
    });
  });
});

describe("/categories/:slug/history document", () => {
  it("is the history under the category's head, titled and noindex", async () => {
    const response = await get("/categories/war/history");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("<title>History of War · Bardic Torch</title>");
    expect(html).toContain('<meta name="robots" content="noindex, follow"/>');
    const main = mainOf(html);
    expect(main).toMatch(/<h1[^>]*>War<\/h1>/);
    expect(main).toContain("2 revisions");
    expect(main).toContain('href="/revisions/1009"');
    expect(main).toContain(
      "Imported from the original wiki, by Archivist and Lorekeeper"
    );
  });

  it("never reads the members: a history page asks for no offset", async () => {
    const seen = requests();
    await get("/categories/war/history?page=2");
    await get("/categories/war/history");
    expect(seen.filter(r => r.startsWith("/v1/terms/war?"))).toEqual([
      "/v1/terms/war?limit=1",
      "/v1/terms/war?limit=1",
    ]);
    expect(
      seen.some(r => r.includes("offset") && !r.includes("/history"))
    ).toBe(false);
  });

  it("is the history's server error under the head for a 500", async () => {
    quietErrors();
    fixtures.fail({
      operationId: "listTermRevisions",
      status: 500,
      code: "internal",
    });
    const response = await get("/categories/war/history");
    expect(response.status).toBe(500);
    const html = await response.text();
    expect(html).toContain(
      "<title>We couldn’t load the history · Bardic Torch</title>"
    );
    expect(mainOf(html)).toMatch(/<h1[^>]*>War<\/h1>/);
  });
});
