import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, routeArgs } from "~/test/context";
import { contractResponse, offContractResponse } from "~/test/contract";
import { serveFixtureApi } from "~/test/msw";
import { serveApp } from "~/test/server-build";
import * as layoutModule from "./events.$slug";
import * as readModule from "./events.$slug._index";

// /events/:slug against the fixture API through msw: the slug check before
// any call, a restricted piece's recording kept out of the page, every
// failure of getEvent, and the documents.

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
    id: "routes/events.$slug._index",
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

async function load(slug: string): Promise<unknown> {
  try {
    return await layoutModule.loader(
      routeArgs(new Request(`https://app.test/events/${slug}`), {
        params: { slug },
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

describe("/events/:slug loader", () => {
  it.each(["Muster-Field", "muster/field", "muster-"])(
    "is our own 404 for %j, with no call",
    async slug => {
      const seen: string[] = [];
      fixtures.server.events.on("request:start", ({ request }) => {
        seen.push(request.url);
      });
      expect(await load(slug)).toMatchObject({
        data: { kind: "not_found" },
        init: { status: 404 },
      });
      expect(seen).toEqual([]);
    }
  );

  it("keeps the API's order and empties a restricted piece's recording", async () => {
    const answer = (await load("midwinter-revel")) as {
      event: {
        performances: {
          piece: { slug: string } | null;
          link: { url: string };
          year: number | null;
        }[];
      };
    };
    expect(answer.event.performances.map(p => p.year)).toEqual([
      2025, 2025, 2023,
    ]);
    const [hoard, carol] = answer.event.performances;
    expect(hoard?.piece?.slug).toBe("the-dragons-hoard");
    expect(hoard?.link.url).toBe("");
    expect(carol?.link.url).toBe("https://video.example/watch/carol");
  });

  it.each([
    [
      "a 404",
      () =>
        contractResponse("getEvent", 404, { code: "not_found", message: "x" }),
      { kind: "not_found" },
      404,
    ],
    [
      "a 400 after our own check",
      () =>
        contractResponse("getEvent", 400, {
          code: "invalid_request",
          message: "x",
        }),
      { kind: "not_found" },
      404,
    ],
    [
      "a 500",
      () =>
        contractResponse("getEvent", 500, { code: "internal", message: "x" }),
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
          "getEvent",
          200,
          { slug: "x" },
          "an Event without its fields"
        ),
      { kind: "bad_gateway" },
      502,
    ],
  ] as const)("throws %s", async (_why, respond, failure, status) => {
    quietErrors();
    fixtures.server.use(
      http.get(`${API_BASE_URL}/v1/events/midwinter-revel`, respond)
    );
    expect(await load("midwinter-revel")).toMatchObject({
      data: failure,
      init: { status },
    });
  });
});

describe("/events/:slug document", () => {
  it("is the event: head, performances and licence, with no restricted link", async () => {
    const response = await get("/events/muster-field");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("<title>Muster Field · Bardic Torch</title>");
    const main = mainOf(html);
    expect(main).toMatch(/<h1[^>]*>Muster Field<\/h1>/);
    expect(main).toContain("Venue");
    expect(main).toContain('href="/pieces/the-dragons-hoard"');
    expect(main).toContain("Link not shown: see the piece page");
    expect(main).toContain("and 3 more");
    expect(main).toContain('href="/events/muster-field/history"');
    expect(html).not.toContain("private-recordings.example");
  });

  it("is the 404 page for an unknown event", async () => {
    quietErrors();
    const response = await get("/events/no-such-event");
    expect(response.status).toBe(404);
    expect(await response.text()).toContain(
      "<title>We couldn’t find that event or venue · Bardic Torch</title>"
    );
  });
});

describe("/events/midwinter-revel outage document", () => {
  it("is the resting page (503) with Retry-After and the document's Cache-Control", async () => {
    quietErrors();
    fixtures.server.use(
      http.get(`${API_BASE_URL}/v1/events/midwinter-revel`, () =>
        HttpResponse.error()
      )
    );
    const response = await get("/events/midwinter-revel");
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(await response.text()).toContain(
      "<title>Bardic Torch is resting · Bardic Torch</title>"
    );
  });
});
