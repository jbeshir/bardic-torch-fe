import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, loadContext } from "~/test/context";
import { contractResponse } from "~/test/contract";
import { serveFixtureApi } from "~/test/msw";
import { sitemap, sitemapIndex } from "./sitemap.server";

// The sitemaps against the fixture API through msw: the index, the pages,
// the paging of 245 fixture pieces, the exclusions and the failure path.

const fixtures = serveFixtureApi();
const ORIGIN = "https://bardictorch.example";

afterEach(() => {
  vi.restoreAllMocks();
});

function quietErrors() {
  return vi.spyOn(console, "error").mockImplementation(() => undefined);
}

/** The `<loc>` addresses of a sitemap. */
function locations(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(match => match[1] ?? "");
}

/** Every API request the fixture sees, as "path?query". */
function upstreamRequests() {
  const seen: string[] = [];
  fixtures.server.events.on("request:start", ({ request }) => {
    const url = new URL(request.url);
    seen.push(`${url.pathname}${url.search}`);
  });
  return seen;
}

function get(type: string | undefined) {
  return sitemap(loadContext(), ORIGIN, type);
}

describe("the sitemap index", () => {
  it("lists the six sitemaps on this origin, as XML cacheable for an hour", async () => {
    const response = sitemapIndex(ORIGIN);
    expect(response.headers.get("Content-Type")).toBe(
      "application/xml; charset=utf-8"
    );
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
    const xml = await response.text();
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
    expect(xml).toContain(
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    );
    expect(locations(xml)).toEqual([
      `${ORIGIN}/sitemap/pages.xml`,
      `${ORIGIN}/sitemap/pieces.xml`,
      `${ORIGIN}/sitemap/bards.xml`,
      `${ORIGIN}/sitemap/categories.xml`,
      `${ORIGIN}/sitemap/collections.xml`,
      `${ORIGIN}/sitemap/events.xml`,
    ]);
  });
});

describe("the pages sitemap", () => {
  it("lists the home page, help and the directories, with no API read", async () => {
    const seen = upstreamRequests();
    const response = await get("pages.xml");
    expect(response.status).toBe(200);
    expect(locations(await response.text())).toEqual([
      `${ORIGIN}/`,
      `${ORIGIN}/help`,
      `${ORIGIN}/help/contributing`,
      `${ORIGIN}/help/faq-for-bards`,
      `${ORIGIN}/help/bard-preference-checklist`,
      `${ORIGIN}/help/conservation-status`,
      `${ORIGIN}/help/licence`,
      `${ORIGIN}/pieces`,
      `${ORIGIN}/bards`,
      `${ORIGIN}/categories`,
      `${ORIGIN}/collections`,
      `${ORIGIN}/events`,
    ]);
    expect(seen).toEqual([]);
  });
});

describe("the pieces sitemap", () => {
  it("reads the 245 fixture pieces in three calls of 100, the later two together", async () => {
    const seen = upstreamRequests();
    const response = await get("pieces.xml");
    expect(response.status).toBe(200);
    expect(seen.sort()).toEqual([
      "/v1/pieces?limit=100&offset=0",
      "/v1/pieces?limit=100&offset=100",
      "/v1/pieces?limit=100&offset=200",
    ]);
    const paths = locations(await response.text());
    expect(paths.length).toBeGreaterThan(200);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain(`${ORIGIN}/pieces/the-copper-kettle`);
  });

  it("leaves out restricted pieces", async () => {
    const all = await fetch(`${API_BASE_URL}/v1/pieces?limit=100`).then(
      response => response.json() as Promise<{ total: number }>
    );
    const restricted = await fetch(
      `${API_BASE_URL}/v1/pieces?conservation_status=restricted&limit=100`
    ).then(
      response =>
        response.json() as Promise<{ total: number; data: { slug: string }[] }>
    );
    expect(restricted.total).toBeGreaterThan(0);
    const paths = locations(await (await get("pieces.xml")).text());
    for (const { slug } of restricted.data) {
      expect(paths).not.toContain(`${ORIGIN}/pieces/${slug}`);
    }
    expect(paths).toHaveLength(all.total - restricted.total);
  });

  it("asks for no more than 101 pages, up to the API's greatest offset, and says the rest are left out", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const offsets: number[] = [];
    fixtures.server.use(
      http.get(`${API_BASE_URL}/v1/pieces`, ({ request }) => {
        offsets.push(Number(new URL(request.url).searchParams.get("offset")));
        return contractResponse("listPieces", 200, {
          data: [],
          total: 500_000,
          facets: {
            terms: [],
            kinds: [],
            conservation_statuses: [],
            letters: [],
          },
        });
      })
    );
    const response = await get("pieces.xml");
    expect(response.status).toBe(200);
    expect(offsets).toHaveLength(101);
    expect(Math.max(...offsets)).toBe(10_000);
    expect(warn).toHaveBeenCalledWith(
      "A sitemap lists the first 10100 of 500000 entries: the API reads no further."
    );
  });

  it("reads the last page the API serves without a warning when that is all there is", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const offsets: number[] = [];
    fixtures.server.use(
      http.get(`${API_BASE_URL}/v1/pieces`, ({ request }) => {
        offsets.push(Number(new URL(request.url).searchParams.get("offset")));
        return contractResponse("listPieces", 200, {
          data: [],
          total: 10_100,
          facets: {
            terms: [],
            kinds: [],
            conservation_statuses: [],
            letters: [],
          },
        });
      })
    );
    expect((await get("pieces.xml")).status).toBe(200);
    expect(Math.max(...offsets)).toBe(10_000);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    [
      "a 500",
      () =>
        contractResponse("listPieces", 500, { code: "internal", message: "x" }),
      60,
    ],
    ["a network failure", () => HttpResponse.error(), 30],
    ["a proxy's 503", () => new HttpResponse("down", { status: 503 }), 60],
  ])(
    "is a 503 with Retry-After and no sitemap when the first page fails with %s",
    async (_why, respond, retryAfter) => {
      quietErrors();
      fixtures.server.use(http.get(`${API_BASE_URL}/v1/pieces`, respond));
      const response = await get("pieces.xml");
      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBe(String(retryAfter));
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.get("Content-Type")).toMatch(/^text\/plain/);
      expect(await response.text()).not.toContain("<urlset");
    }
  );

  it("is a 503, not a partial sitemap, when a later page fails", async () => {
    quietErrors();
    fixtures.server.use(
      http.get(`${API_BASE_URL}/v1/pieces`, ({ request }) =>
        new URL(request.url).searchParams.get("offset") === "200"
          ? contractResponse("listPieces", 500, {
              code: "internal",
              message: "x",
            })
          : undefined
      )
    );
    const response = await get("pieces.xml");
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("<loc>");
  });
});

describe("the bards sitemap", () => {
  it("lists persons with a page and leaves out stubs", async () => {
    const seen = upstreamRequests();
    const response = await get("bards.xml");
    expect(response.status).toBe(200);
    expect(seen).toEqual(["/v1/persons?limit=100&offset=0"]);
    const listed = await fetch(`${API_BASE_URL}/v1/persons?limit=100`).then(
      reply =>
        reply.json() as Promise<{
          data: { slug: string; is_stub: boolean }[];
        }>
    );
    const stubs = listed.data.filter(person => person.is_stub);
    expect(stubs.length).toBeGreaterThan(0);
    const paths = locations(await response.text());
    expect(paths).toHaveLength(listed.data.length - stubs.length);
    for (const { slug } of stubs) {
      expect(paths).not.toContain(`${ORIGIN}/bards/${slug}`);
    }
  });

  it("is a 503 when persons fail", async () => {
    quietErrors();
    fixtures.fail({
      operationId: "listPersons",
      status: 500,
      code: "internal",
    });
    const response = await get("bards.xml");
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
  });
});

describe("the categories, collections and events sitemaps", () => {
  it("lists every category from one unpaged read", async () => {
    const seen = upstreamRequests();
    const response = await get("categories.xml");
    expect(response.status).toBe(200);
    expect(seen).toEqual(["/v1/terms"]);
    const paths = locations(await response.text());
    expect(paths).toContain(`${ORIGIN}/categories/warlike`);
    expect(paths).toContain(`${ORIGIN}/categories/northmarch`);
  });

  it("lists every collection by id, and every event and venue by slug", async () => {
    const seen = upstreamRequests();
    const collections = locations(await (await get("collections.xml")).text());
    expect(collections).toContain(`${ORIGIN}/collections/12`);
    const events = locations(await (await get("events.xml")).text());
    expect(events).toContain(`${ORIGIN}/events/muster-field`);
    expect(events).toContain(`${ORIGIN}/events/midwinter-revel`);
    expect(seen).toEqual([
      "/v1/collections?limit=100&offset=0",
      "/v1/events?limit=100&offset=0",
    ]);
  });

  it.each([
    ["categories.xml", "listTerms"],
    ["collections.xml", "listCollections"],
    ["events.xml", "listEvents"],
  ] as const)("is a 503 for %s when %s fails", async (type, operationId) => {
    quietErrors();
    fixtures.fail({ operationId, status: 500, code: "internal" });
    const response = await get(type);
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
  });
});

describe("an unknown sitemap", () => {
  it.each([
    "nope.xml",
    "pieces",
    "pieces.xml.gz",
    "",
    undefined,
    "../pieces.xml",
  ])("is a plain 404 for %s, with no API read", async type => {
    const seen = upstreamRequests();
    const response = await get(type);
    expect(response.status).toBe(404);
    expect(seen).toEqual([]);
  });
});
