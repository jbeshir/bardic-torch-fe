import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, routeArgs } from "~/test/context";
import { historyFailures, historyRedirects } from "~/test/history-cases";
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

async function load(id: string, search = ""): Promise<unknown> {
  try {
    return await historyModule.loader(
      routeArgs(new Request(`https://app.test/events/${id}/history${search}`), {
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

  it.each(historyRedirects("/events/midwinter-revel/history"))(
    "redirects %s",
    async (_why, search, status, location) => {
      const answer = await load("midwinter-revel", search);
      expect(answer).toBeInstanceOf(Response);
      expect((answer as Response).status).toBe(status);
      expect((answer as Response).headers.get("Location")).toBe(location);
    }
  );

  it.each(historyFailures("listEventRevisions"))(
    "throws %s",
    async (_why, respond, failure, status) => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      fixtures.server.use(
        http.get(`${API_BASE_URL}/v1/events/midwinter-revel/history`, respond)
      );
      expect(await load("midwinter-revel")).toMatchObject({
        data: failure,
        init: { status },
      });
    }
  );

  it("answers the document 503 with Retry-After when the history is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fixtures.server.use(
      http.get(`${API_BASE_URL}/v1/events/midwinter-revel/history`, () =>
        HttpResponse.error()
      )
    );
    const response = await get("/events/midwinter-revel/history");
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache");
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
