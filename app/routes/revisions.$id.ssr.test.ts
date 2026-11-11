import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, routeArgs } from "~/test/context";
import { contractResponse } from "~/test/contract";
import { serveFixtureApi } from "~/test/msw";
import { serveApp } from "~/test/server-build";
import * as revisionModule from "./revisions.$id";

// /revisions/:id against the fixture API through msw: the id check, every
// failure of getRevision, each entity type's document, the caveat, and a
// restricted piece's revision with no external link to its addresses.

const fixtures = serveFixtureApi();
const get = serveApp([
  {
    id: "routes/revisions.$id",
    path: "revisions/:id",
    module: revisionModule,
    hasLoader: true,
    hasErrorBoundary: true,
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
    return await revisionModule.loader(
      routeArgs(new Request(`https://app.test/revisions/${id}`), {
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

const CAVEAT = "This is how the revision looks today.";

describe("/revisions/:id loader", () => {
  it.each(["0", "01", "abc", "99999999999999999999"])(
    "is our own 404 for %j, with no call",
    async id => {
      const seen: string[] = [];
      fixtures.server.events.on("request:start", ({ request }) => {
        seen.push(request.url);
      });
      expect(await load(id)).toMatchObject({
        data: { kind: "not_found" },
        init: { status: 404 },
      });
      expect(seen).toEqual([]);
    }
  );

  it("is a 404 for a revision that isn't approved", async () => {
    quietErrors();
    expect(await load("1015")).toMatchObject({ init: { status: 404 } });
  });

  it.each([
    [
      "a 400 after our own check",
      () =>
        contractResponse("getRevision", 400, {
          code: "invalid_request",
          message: "x",
        }),
      { kind: "not_found" },
      404,
    ],
    [
      "a 500",
      () =>
        contractResponse("getRevision", 500, {
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
      () => new HttpResponse("not JSON", { status: 200 }),
      { kind: "bad_gateway" },
      502,
    ],
  ] as const)("throws %s", async (_why, respond, failure, status) => {
    quietErrors();
    fixtures.server.use(http.get(`${API_BASE_URL}/v1/revisions/1003`, respond));
    expect(await load("1003")).toMatchObject({
      data: failure,
      init: { status },
    });
  });
});

describe("/revisions/:id document", () => {
  it("is a piece's revision with its base: head, caveat and changes", async () => {
    const response = await get("/revisions/1003");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain(
      "<title>Revision 1003 of The Copper Kettle · Bardic Torch</title>"
    );
    expect(html).toContain('<meta name="robots" content="noindex, follow"/>');
    const main = mainOf(html);
    expect(main).toMatch(
      /<h1[^>]*>Revision <!-- -->1003<!-- --> of <!-- -->The Copper Kettle<\/h1>/
    );
    expect(main).toContain("1 Feb 2026");
    expect(main).toContain("Morwen of the Marches");
    expect(main).toContain("Added the tune credit, links and a licence");
    expect(main).toContain(CAVEAT);
    expect(main).toContain('href="/pieces/the-copper-kettle"');
    expect(main).toContain('href="/pieces/the-copper-kettle/history"');
    expect(main).toContain('href="/revisions/1001"');
    expect(main).toMatch(/<h2[^>]*>Changes<\/h2>/);
    expect(main).toContain("Credits");
  });

  it.each([
    ["1001", "a piece", "The Copper Kettle", "/pieces/the-copper-kettle"],
    ["1006", "a person", "Wren of the Vale", "/bards/wren-of-the-vale"],
    ["1008", "a term", "War", "/categories/war"],
    ["1010", "a collection", "The Northmarch Songbook", "/collections/12"],
    ["1012", "an event", "Midwinter Revel", "/events/midwinter-revel"],
  ])(
    "is %s's first version (%s), with no older revision",
    async (id, _what, title, path) => {
      const main = mainOf(await (await get(`/revisions/${id}`)).text());
      expect(main).toContain(title);
      expect(main).toContain(`href="${path}"`);
      expect(main).toMatch(/<h2[^>]*>First recorded version<\/h2>/);
      expect(main).toContain(
        "Imported from the original wiki, by Archivist and Lorekeeper"
      );
      expect(main).toContain(CAVEAT);
      expect(main).not.toContain("Previous revision");
    }
  );

  it("names the MCP tool for a revision made through it", async () => {
    expect(mainOf(await (await get("/revisions/1004")).text())).toContain(
      "Morwen of the Marches (edited with an app)"
    );
  });

  it("shows a restricted piece's revision with no link to its addresses", async () => {
    const html = await (await get("/revisions/1005")).text();
    const main = mainOf(html);
    expect(main).toContain("its links are shown as text only");
    expect(main).not.toMatch(/<a[^>]*href="https?:\/\/(?!creativecommons)/);
    // Not in the data the page hydrates from either: no snapshot goes there.
    expect(html).not.toContain("private-recordings.example");
  });

  it("is the 404 page titled for the revision", async () => {
    const response = await get("/revisions/007");
    expect(response.status).toBe(404);
    expect(await response.text()).toContain(
      "<title>We couldn’t find that revision · Bardic Torch</title>"
    );
  });
});

describe("/revisions/1007 outage document", () => {
  it("is the resting page (503) with Retry-After and the document's Cache-Control", async () => {
    quietErrors();
    fixtures.server.use(
      http.get(`${API_BASE_URL}/v1/revisions/1007`, () => HttpResponse.error())
    );
    const response = await get("/revisions/1007");
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(await response.text()).toContain(
      "<title>Bardic Torch is resting · Bardic Torch</title>"
    );
  });
});
