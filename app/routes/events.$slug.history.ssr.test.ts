import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, routeArgs } from "~/test/context";
import { contractResponse } from "~/test/contract";
import { serveFixtureApi } from "~/test/msw";
import { serveApp } from "~/test/server-build";
import * as layoutModule from "./events.$slug";
import * as historyModule from "./events.$slug.history";

// /events/:slug/history: the id check, a failure, and the document.

const fixtures = serveFixtureApi();
const LAYOUT = "routes/events.$slug";
const get = serveApp([
  {
    id: LAYOUT,
    path: "events/:slug",
    module: layoutModule,
    hasLoader: true,
    hasErrorBoundary: true,
  },
  {
    id: "routes/events.$slug.history",
    parentId: LAYOUT,
    path: "history",
    module: historyModule,
    hasLoader: true,
    hasErrorBoundary: true,
  },
]);

afterEach(() => {
  vi.restoreAllMocks();
});

async function load(id: string): Promise<unknown> {
  try {
    return await historyModule.loader(
      routeArgs(new Request(`https://app.test/events/${id}/history`), {
        params: { slug: id },
      })
    );
  } catch (thrown) {
    return thrown;
  }
}

describe("/events/:slug/history", () => {
  it.each(["Midwinter", "a--b", "x-"])("is our own 404 for %j", async id => {
    expect(await load(id)).toMatchObject({ init: { status: 404 } });
  });

  it("throws the history's failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fixtures.server.use(
      http.get(`${API_BASE_URL}/v1/events/midwinter-revel/history`, () =>
        contractResponse("listEventRevisions", 500, {
          code: "internal",
          message: "x",
        })
      )
    );
    expect(await load("midwinter-revel")).toMatchObject({
      data: { kind: "server" },
      init: { status: 500 },
    });
    fixtures.server.use(
      http.get(`${API_BASE_URL}/v1/events/midwinter-revel/history`, () =>
        HttpResponse.error()
      )
    );
    expect(await load("midwinter-revel")).toMatchObject({
      init: { status: 503 },
    });
  });

  it("is the event's history, titled and noindex", async () => {
    const html = await (await get("/events/midwinter-revel/history")).text();
    expect(html).toContain(
      "<title>History of Midwinter Revel · Bardic Torch</title>"
    );
    expect(html).toContain('<meta name="robots" content="noindex, follow"/>');
    expect(html).toContain('href="/revisions/1013"');
  });
});
