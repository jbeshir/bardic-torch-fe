import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, routeArgs } from "~/test/context";
import { contractResponse, offContractResponse } from "~/test/contract";
import { serveFixtureApi } from "~/test/msw";
import { serveApp } from "~/test/server-build";
import * as eventsModule from "./events._index";

// /events against the fixture API through msw: the kind's canonical form,
// paging past the end, every failure (all thrown: listEvents is no
// search), and the documents.

const fixtures = serveFixtureApi();
const get = serveApp([
  {
    id: "routes/events._index",
    path: "events",
    module: eventsModule,
    hasLoader: true,
    hasErrorBoundary: true,
  },
]);
const EVENTS = `${API_BASE_URL}/v1/events`;

afterEach(() => {
  vi.restoreAllMocks();
});

function quietErrors() {
  return vi.spyOn(console, "error").mockImplementation(() => undefined);
}

async function load(search: string): Promise<unknown> {
  try {
    return await eventsModule.loader(
      routeArgs(new Request(`https://app.test/events${search}`))
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

describe("/events loader", () => {
  it("lists one kind", async () => {
    const answer = (await load("?kind=venue")) as {
      list: { data: { kind: string }[] };
    };
    expect(answer.list.data.map(e => e.kind)).toEqual([
      "venue",
      "venue",
      "venue",
    ]);
  });

  it.each([
    ["an upper-case kind", "?kind=Venue", "/events?kind=venue"],
    ["an invalid kind", "?kind=tavern", "/events"],
    ["a repeated kind", "?kind=venue&kind=event", "/events?kind=venue"],
  ])("redirects %s with one 301", async (_why, search, location) => {
    expect(await redirectOf(search)).toEqual({ status: 301, location });
  });

  it.each([
    ["past the end", "?page=2", "/events"],
    ["past the API", "?kind=venue&page=500", "/events?kind=venue"],
  ])("sends a page %s on with one 302", async (_why, search, location) => {
    expect(await redirectOf(search)).toEqual({ status: 302, location });
  });

  it.each([
    [
      "a 500, even with a kind",
      "?kind=venue",
      () =>
        contractResponse("listEvents", 500, { code: "internal", message: "x" }),
      { kind: "server" },
      500,
    ],
    [
      "a 400 (the app and the API disagree)",
      "",
      () =>
        contractResponse("listEvents", 400, {
          code: "invalid_request",
          message: "x",
        }),
      { kind: "bad_gateway" },
      502,
    ],
    [
      "a network failure",
      "",
      () => HttpResponse.error(),
      { kind: "resting", retryAfter: 30 },
      503,
    ],
    [
      "a proxy's 503",
      "",
      () => new HttpResponse("down", { status: 503 }),
      { kind: "resting", retryAfter: 60 },
      503,
    ],
    [
      "a malformed body",
      "",
      () => offContractResponse("listEvents", 200, { data: [] }, "no total"),
      { kind: "bad_gateway" },
      502,
    ],
  ] as const)("throws %s", async (_why, search, respond, failure, status) => {
    quietErrors();
    fixtures.server.use(http.get(EVENTS, respond));
    expect(await load(search)).toMatchObject({
      data: failure,
      init: { status },
    });
  });
});

describe("/events document", () => {
  it("lists the events and venues with the kind switch", async () => {
    const response = await get("/events");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("<title>Events and venues · Bardic Torch</title>");
    const main = mainOf(html);
    expect(main).toContain("8 events and venues");
    expect(main).toContain('href="/events/muster-field"');
    expect(main).toContain('href="/events?kind=venue"');
  });

  it("titles one kind", async () => {
    const html = await (await get("/events?kind=venue")).text();
    expect(html).toContain("<title>Venues · Bardic Torch</title>");
    expect(html).toMatch(
      /<link rel="canonical" href="https:\/\/app\.test\/events\?kind=venue"\/?>/
    );
  });

  it("is the server error for a 500, not the slow-search page", async () => {
    quietErrors();
    fixtures.fail({ operationId: "listEvents", status: 500, code: "internal" });
    const response = await get("/events?kind=event");
    expect(response.status).toBe(500);
    expect(mainOf(await response.text())).toMatch(
      /<h1[^>]*>We couldn’t load the events and venues<\/h1>/
    );
  });
});

describe("/events outage document", () => {
  it("is the resting page (503) with Retry-After and the document's Cache-Control", async () => {
    quietErrors();
    fixtures.server.use(http.get(EVENTS, () => HttpResponse.error()));
    const response = await get("/events");
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(await response.text()).toContain(
      "<title>Bardic Torch is resting · Bardic Torch</title>"
    );
  });
});
