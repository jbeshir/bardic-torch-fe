import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, routeArgs } from "~/test/context";
import { historyFailures, historyRedirects } from "~/test/history-cases";
import { serveFixtureApi } from "~/test/msw";
import { serveApp } from "~/test/server-build";
import * as layoutModule from "./pieces.$slug";
import * as historyModule from "./pieces.$slug.history";

// /pieces/:slug/history: the slug check, the history's failures, and the
// document the layout and the view make together.

const fixtures = serveFixtureApi();
const LAYOUT = "routes/pieces.$slug";
const get = serveApp([
  {
    id: LAYOUT,
    path: "pieces/:slug",
    module: layoutModule,
    hasLoader: true,
    hasErrorBoundary: true,
  },
  {
    id: "routes/pieces.$slug.history",
    parentId: LAYOUT,
    path: "history",
    module: historyModule,
    hasLoader: true,
    hasErrorBoundary: true,
  },
]);

const HISTORY = `${API_BASE_URL}/v1/pieces/the-copper-kettle/history`;

afterEach(() => {
  vi.restoreAllMocks();
});

async function load(slug: string, search = ""): Promise<unknown> {
  try {
    return await historyModule.loader(
      routeArgs(
        new Request(`https://app.test/pieces/${slug}/history${search}`),
        {
          params: { slug },
        }
      )
    );
  } catch (thrown) {
    return thrown;
  }
}

describe("/pieces/:slug/history", () => {
  it.each(["Bad", "a--b", ""])("is our own 404 for %j", async slug => {
    expect(await load(slug)).toMatchObject({ init: { status: 404 } });
  });

  it("reads the newest page of revisions", async () => {
    const loaded = (await load("the-copper-kettle")) as {
      readonly state: unknown;
      readonly history: { readonly data: readonly { readonly id: number }[] };
    };
    expect(loaded.state).toEqual({ page: 1 });
    expect(loaded.history.data[0]?.id).toBe(1014);
  });

  it("sends a page past the end back to the first, and a page 1 to none", async () => {
    expect(await load("the-copper-kettle", "?page=4")).toMatchObject({
      status: 302,
    });
    expect(await load("the-copper-kettle", "?page=1")).toMatchObject({
      status: 301,
    });
  });

  it.each(historyRedirects("/pieces/the-copper-kettle/history"))(
    "redirects %s",
    async (_why, search, status, location) => {
      const answer = await load("the-copper-kettle", search);
      expect(answer).toBeInstanceOf(Response);
      expect((answer as Response).status).toBe(status);
      expect((answer as Response).headers.get("Location")).toBe(location);
    }
  );

  it.each(historyFailures("listPieceRevisions"))(
    "throws %s",
    async (_why, respond, failure, status) => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      fixtures.server.use(http.get(HISTORY, respond));
      expect(await load("the-copper-kettle")).toMatchObject({
        data: failure,
        init: { status },
      });
    }
  );

  it("answers the document 503 with Retry-After when the history is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fixtures.server.use(http.get(HISTORY, () => HttpResponse.error()));
    const response = await get("/pieces/the-copper-kettle/history");
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache");
  });

  it("is the piece's history, titled and noindex", async () => {
    const html = await (await get("/pieces/the-copper-kettle/history")).text();
    expect(html).toContain(
      "<title>History of The Copper Kettle · Bardic Torch</title>"
    );
    expect(html).toContain('<meta name="robots" content="noindex, follow"/>');
    expect(html).toContain('href="/revisions/1014"');
  });

  it("keeps a restricted piece's history out of search, with nothing to follow", async () => {
    const html = await (await get("/pieces/the-dragons-hoard/history")).text();
    expect(html).toContain('<meta name="robots" content="noindex, nofollow"/>');
  });
});
