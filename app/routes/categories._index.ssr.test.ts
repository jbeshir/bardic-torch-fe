import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  API_BASE_URL,
  routeArgs,
  sessionCookie,
  sessionTokens,
} from "~/test/context";
import { contractResponse, offContractResponse } from "~/test/contract";
import { serveFixtureApi } from "~/test/msw";
import { serveApp } from "~/test/server-build";
import * as categoriesModule from "./categories._index";

// /categories against the fixture API through msw: which reads each view
// makes (the two piece-field sections never reach listTerms), the region
// failure of the counts, the page failures, and the documents.

const fixtures = serveFixtureApi();
const get = serveApp([
  {
    id: "routes/categories._index",
    path: "categories",
    module: categoriesModule,
    hasLoader: true,
    hasErrorBoundary: true,
  },
]);

const TERMS = `${API_BASE_URL}/v1/terms`;
const PIECES = `${API_BASE_URL}/v1/pieces`;

afterEach(() => {
  vi.restoreAllMocks();
});

function quietErrors() {
  return vi.spyOn(console, "error").mockImplementation(() => undefined);
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

async function load(search: string): Promise<unknown> {
  try {
    return await categoriesModule.loader(
      routeArgs(new Request(`https://app.test/categories${search}`))
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

describe("/categories loader", () => {
  it("reads the whole tree and the piece counts, in parallel", async () => {
    const seen = upstreamRequests();
    const answer = await load("");
    expect(seen.sort()).toEqual(["/v1/pieces?limit=1", "/v1/terms"]);
    expect(answer).toMatchObject({
      state: { facet: undefined },
      counts: {
        kinds: expect.arrayContaining([
          expect.objectContaining({ kind: "song" }),
        ]),
      },
    });
  });

  it.each(["mood", "affiliation"])(
    "reads one facet's terms alone for ?facet=%s",
    async facet => {
      const seen = upstreamRequests();
      const answer = await load(`?facet=${facet}`);
      expect(seen).toEqual([`/v1/terms?facet=${facet}`]);
      expect(answer).toMatchObject({ counts: null });
    }
  );

  it.each(["kind", "conservation"])(
    "never sends ?facet=%s to listTerms: it reads the piece counts only",
    async facet => {
      const seen = upstreamRequests();
      const answer = await load(`?facet=${facet}`);
      expect(seen).toEqual(["/v1/pieces?limit=1"]);
      expect(seen.some(request => request.startsWith("/v1/terms"))).toBe(false);
      expect(answer).toMatchObject({ terms: null });
    }
  );

  it.each([
    ["an invalid facet", "?facet=genre", "/categories"],
    ["an upper-case facet", "?facet=Mood", "/categories"],
    ["an unknown parameter", "?page=2", "/categories"],
  ])("redirects %s with one 301", async (_why, search, location) => {
    const answer = await load(search);
    expect(answer).toBeInstanceOf(Response);
    expect((answer as Response).status).toBe(301);
    expect((answer as Response).headers.get("Location")).toBe(location);
  });

  it("keeps the tree when the counts fail: they are a region", async () => {
    quietErrors();
    fixtures.fail({ operationId: "listPieces", status: 500, code: "internal" });
    expect(await load("")).toMatchObject({ counts: "failed" });
  });

  it("is a bad gateway for a 400 on the counts: the query is ours, not the reader's", async () => {
    quietErrors();
    fixtures.fail({
      operationId: "listPieces",
      status: 400,
      code: "invalid_request",
    });
    expect(await load("?facet=kind")).toMatchObject({
      data: { kind: "bad_gateway" },
      init: { status: 502 },
    });
  });

  it("is the page's failure when the counts are the page", async () => {
    quietErrors();
    fixtures.fail({ operationId: "listPieces", status: 500, code: "internal" });
    expect(await load("?facet=kind")).toMatchObject({
      data: { kind: "server" },
      init: { status: 500 },
    });
  });

  it.each([
    [
      "a 500",
      () =>
        contractResponse("listTerms", 500, { code: "internal", message: "x" }),
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
          "listTerms",
          200,
          { data: [{ slug: 1 }] },
          "a term without its fields"
        ),
      { kind: "bad_gateway" },
      502,
    ],
    [
      "a 400 (the app and the API disagree)",
      () =>
        contractResponse("listTerms", 400, {
          code: "invalid_request",
          message: "x",
        }),
      { kind: "bad_gateway" },
      502,
    ],
  ] as const)(
    "throws the tree's failure for %s",
    async (_why, respond, failure, status) => {
      quietErrors();
      fixtures.server.use(http.get(TERMS, respond));
      expect(await load("")).toMatchObject({
        data: failure,
        init: { status },
      });
    }
  );
});

describe("/categories document", () => {
  it("lists every facet's tree with counts, and the kinds and statuses", async () => {
    const response = await get("/categories");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("<title>Categories · Bardic Torch</title>");
    expect(html).toMatch(
      /<link rel="canonical" href="https:\/\/app\.test\/categories"\/?>/
    );
    const main = mainOf(html);
    expect(main).toMatch(/<h1[^>]*>Categories<\/h1>/);
    for (const heading of [
      "Kind",
      "Mood",
      "Topic",
      "Affiliation",
      "Conservation status",
    ]) {
      expect(main).toMatch(new RegExp(`<h2[^>]*>${heading}</h2>`));
    }
    expect(main).toContain('href="/categories/swords"');
    expect(main).toContain('href="/pieces?kind=song"');
    expect(main).toContain('href="/pieces?status=endangered"');
    // The empty Other facet's root is still listed, with its 0.
    expect(main).toContain('href="/categories/miscellany"');
  });

  it("shows one facet under its own h1, with a breadcrumb back", async () => {
    const html = await (await get("/categories?facet=mood")).text();
    expect(html).toContain("<title>Mood · Categories · Bardic Torch</title>");
    const main = mainOf(html);
    expect(main).toMatch(/<h1[^>]*>Mood<\/h1>/);
    expect(main).toContain('aria-label="Breadcrumb"');
    expect(main).toContain('href="/categories/warlike"');
    expect(main).not.toContain('href="/categories/swords"');
  });

  it("describes what each section counts: bards for affiliations", async () => {
    const affiliations = await (
      await get("/categories?facet=affiliation")
    ).text();
    expect(affiliations).toContain(
      "categories of the Bardic Torch catalogue, with how many bards each has."
    );
    const moods = await (await get("/categories?facet=mood")).text();
    expect(moods).toContain("with how many pieces each has.");
    const index = await (await get("/categories")).text();
    expect(index).toContain('affiliations, with their pieces and bards."');
  });

  it("is a SectionError for the counts, the tree still 200", async () => {
    quietErrors();
    fixtures.fail({ operationId: "listPieces", status: 500, code: "internal" });
    const response = await get("/categories");
    expect(response.status).toBe(200);
    const main = mainOf(await response.text());
    expect(main).toContain(
      "We couldn’t load the kinds and conservation statuses"
    );
    expect(main).toContain('href="/categories/swords"');
  });

  it.each([
    ["signed out", undefined, "private, no-cache"],
    ["signed in", "in", "no-store"],
  ])(
    "is the resting page (503) with Retry-After, %s",
    async (_who, who, cacheControl) => {
      quietErrors();
      fixtures.server.use(http.get(TERMS, () => HttpResponse.error()));
      const response = await get(
        "/categories",
        who
          ? await sessionCookie(
              sessionTokens({ accessToken: "fixture:contributor" })
            )
          : undefined
      );
      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBe("30");
      expect(response.headers.get("Cache-Control")).toBe(cacheControl);
      const html = await response.text();
      expect(html).toContain(
        "<title>Bardic Torch is resting · Bardic Torch</title>"
      );
      expect(html).toContain('aria-label="Site"');
    }
  );

  it("titles a server error by what didn't load", async () => {
    quietErrors();
    fixtures.fail({ operationId: "listTerms", status: 500, code: "internal" });
    const response = await get("/categories?facet=topic");
    expect(response.status).toBe(500);
    const html = await response.text();
    expect(html).toContain(
      "<title>We couldn’t load the categories · Bardic Torch</title>"
    );
    expect(mainOf(html)).toMatch(
      /<h1[^>]*>We couldn’t load the categories<\/h1>/
    );
  });

  it("never calls the API for a facet it would refuse", async () => {
    const seen: string[] = [];
    fixtures.server.events.on("request:start", ({ request }) => {
      seen.push(request.url);
    });
    const response = await get("/categories?facet=Genre");
    expect(response.status).toBe(301);
    expect(seen.filter(url => url.startsWith(TERMS))).toEqual([]);
    expect(seen.filter(url => url.startsWith(PIECES))).toEqual([]);
  });
});
