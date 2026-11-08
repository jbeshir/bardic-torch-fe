import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, routeArgs } from "~/test/context";
import { contractResponse } from "~/test/contract";
import { serveFixtureApi } from "~/test/msw";
import { serveApp } from "~/test/server-build";
import * as layoutModule from "./bards.$slug";
import * as historyModule from "./bards.$slug.history";

// /bards/:slug/history: the slug check, the history's failures, and the
// document the layout and the view make together.

const fixtures = serveFixtureApi();
const LAYOUT = "routes/bards.$slug";
const get = serveApp([
  {
    id: LAYOUT,
    path: "bards/:slug",
    module: layoutModule,
    hasLoader: true,
    hasErrorBoundary: true,
  },
  {
    id: "routes/bards.$slug.history",
    parentId: LAYOUT,
    path: "history",
    module: historyModule,
    hasLoader: true,
    hasErrorBoundary: true,
  },
]);

const HISTORY = `${API_BASE_URL}/v1/persons/wren-of-the-vale/history`;

afterEach(() => {
  vi.restoreAllMocks();
});

async function load(slug: string, search = ""): Promise<unknown> {
  try {
    return await historyModule.loader(
      routeArgs(
        new Request(`https://app.test/bards/${slug}/history${search}`),
        {
          params: { slug },
        }
      )
    );
  } catch (thrown) {
    return thrown;
  }
}

describe("/bards/:slug/history", () => {
  it.each(["Bad", "a--b", ""])("is our own 404 for %j", async slug => {
    expect(await load(slug)).toMatchObject({ init: { status: 404 } });
  });

  it("reads the newest page of revisions", async () => {
    const loaded = (await load("wren-of-the-vale")) as {
      readonly state: unknown;
      readonly history: { readonly data: readonly { readonly id: number }[] };
    };
    expect(loaded.state).toEqual({ page: 1 });
    expect(loaded.history.data[0]?.id).toBe(1007);
  });

  it("sends a page past the end back to the first, and a page 1 to none", async () => {
    expect(await load("wren-of-the-vale", "?page=4")).toMatchObject({
      status: 302,
    });
    expect(await load("wren-of-the-vale", "?page=1")).toMatchObject({
      status: 301,
    });
  });

  it("throws the history's failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fixtures.server.use(
      http.get(HISTORY, () =>
        contractResponse("listPersonRevisions", 500, {
          code: "internal",
          message: "x",
        })
      )
    );
    expect(await load("wren-of-the-vale")).toMatchObject({
      data: { kind: "server" },
      init: { status: 500 },
    });
    fixtures.server.use(http.get(HISTORY, () => HttpResponse.error()));
    expect(await load("wren-of-the-vale")).toMatchObject({
      init: { status: 503 },
    });
    expect(await load("no-such-bard")).toMatchObject({
      data: { kind: "not_found" },
      init: { status: 404 },
    });
  });

  it("is the bard's history, titled and noindex", async () => {
    const html = await (await get("/bards/wren-of-the-vale/history")).text();
    expect(html).toContain(
      "<title>History of Wren of the Vale · Bardic Torch</title>"
    );
    expect(html).toContain('<meta name="robots" content="noindex, follow"/>');
    expect(html).toContain('href="/revisions/1007"');
  });
});
