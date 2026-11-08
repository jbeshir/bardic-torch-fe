import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, routeArgs } from "~/test/context";
import { contractResponse } from "~/test/contract";
import { serveFixtureApi } from "~/test/msw";
import { serveApp } from "~/test/server-build";
import * as layoutModule from "./collections.$id";
import * as historyModule from "./collections.$id.history";

// /collections/:id/history: the id check, a failure, and the document.

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
    id: "routes/collections.$id.history",
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
      routeArgs(new Request(`https://app.test/collections/${id}/history`), {
        params: { id },
      })
    );
  } catch (thrown) {
    return thrown;
  }
}

describe("/collections/:id/history", () => {
  it.each(["0", "012", "x"])("is our own 404 for %j", async id => {
    expect(await load(id)).toMatchObject({ init: { status: 404 } });
  });

  it("throws the history's failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fixtures.server.use(
      http.get(`${API_BASE_URL}/v1/collections/12/history`, () =>
        contractResponse("listCollectionRevisions", 500, {
          code: "internal",
          message: "x",
        })
      )
    );
    expect(await load("12")).toMatchObject({
      data: { kind: "server" },
      init: { status: 500 },
    });
    fixtures.server.use(
      http.get(`${API_BASE_URL}/v1/collections/12/history`, () =>
        HttpResponse.error()
      )
    );
    expect(await load("12")).toMatchObject({ init: { status: 503 } });
  });

  it("is the collection's history, titled and noindex", async () => {
    const html = await (await get("/collections/12/history")).text();
    expect(html).toContain(
      "<title>History of The Northmarch Songbook · Bardic Torch</title>"
    );
    expect(html).toContain('<meta name="robots" content="noindex, follow"/>');
    expect(html).toContain('href="/revisions/1011"');
  });
});
