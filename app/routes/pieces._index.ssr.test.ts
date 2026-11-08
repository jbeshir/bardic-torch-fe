import { delay, http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  API_BASE_URL,
  routeArgs,
  sessionCookie,
  sessionTokens,
} from "~/test/context";
import { offContractResponse } from "~/test/contract";
import { serveFixtureApi } from "~/test/msw";
import { serveApp } from "~/test/server-build";
import { singleFetchResults } from "~/test/single-fetch";
import * as piecesModule from "./pieces._index";

// /pieces against the fixture API through msw: the loader on its own (the
// canonical and paging redirects, every failure of listPieces), and the
// documents and `.data` answers the real server entry and root make of it.

const fixtures = serveFixtureApi();
const get = serveApp([
  {
    id: "routes/pieces._index",
    path: "pieces",
    module: piecesModule,
    hasLoader: true,
    hasErrorBoundary: true,
  },
]);

const PIECES = `${API_BASE_URL}/v1/pieces`;
const ROUTE = "routes/pieces._index";

afterEach(() => {
  vi.restoreAllMocks();
});

function quietErrors() {
  return vi.spyOn(console, "error").mockImplementation(() => undefined);
}

const signedIn = () =>
  sessionCookie(sessionTokens({ accessToken: "fixture:contributor" }));

/** The listPieces requests the fixture API sees, decoded. */
function upstreamRequests() {
  const seen: URLSearchParams[] = [];
  fixtures.server.events.on("request:start", ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname === "/v1/pieces") seen.push(url.searchParams);
  });
  return seen;
}

/** Runs the loader for `/pieces{search}`; a thrown Response is returned. */
async function load(search: string): Promise<unknown> {
  try {
    return await piecesModule.loader(
      routeArgs(new Request(`https://app.test/pieces${search}`), {
        pattern: "/pieces",
      })
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

/** Make the fixture API answer like a proxy whose backend is down. */
async function outage(match: Readonly<Record<string, string>>) {
  const response = await fetch(`${API_BASE_URL}/__fixtures/outage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operationId: "listPieces", match, mode: "503" }),
  });
  expect(response.ok).toBe(true);
}

function mainOf(html: string): string {
  return html.slice(
    html.indexOf('<main id="content"'),
    html.indexOf("</main>")
  );
}

describe("/pieces loader: the canonical URL (plan §2.2)", () => {
  it.each([
    ["a duplicate", "?kind=song&kind=song", "/pieces?kind=song"],
    ["an unknown parameter", "?utm_source=mail&letter=T", "/pieces?letter=T"],
    ["an empty value", "?q=&letter=", "/pieces"],
    ["page 1", "?letter=T&page=1", "/pieces?letter=T"],
    ["a lower-case letter", "?letter=a", "/pieces?letter=A"],
    ["relevance without q", "?sort=relevance", "/pieces"],
    ["the API's own names", "?offset=50&limit=10", "/pieces"],
  ])("redirects %s with one 301", async (_why, search, location) => {
    expect(await redirectOf(search)).toEqual({ status: 301, location });
    // The target is canonical: answered, not redirected again.
    expect(await redirectOf(location.slice("/pieces".length))).toBeNull();
  });

  it.each([
    "?letter=T&q=kettle",
    "?q=a~b",
    "?q=a%7Eb",
    "?q=it%27s",
    "?q=a%20b",
    "?q=%c3%a9",
  ])("answers %s without a redirect", async search => {
    expect(await redirectOf(search)).toBeNull();
  });

  it("never sends the API a repeated scalar", async () => {
    const seen = upstreamRequests();
    expect(await redirectOf("?letter=A&letter=B")).toEqual({
      status: 301,
      location: "/pieces?letter=A",
    });
    expect(seen).toHaveLength(0);
    await load("?letter=A");
    expect(seen).toHaveLength(1);
    expect(seen[0]?.getAll("letter")).toEqual(["A"]);
  });

  it("asks the API for the state's page, with the API's names", async () => {
    const seen = upstreamRequests();
    await load("?status=endangered&stub=false&page=2");
    expect([...(seen[0] ?? [])]).toEqual([
      ["conservation_status", "endangered"],
      ["stub", "false"],
      ["limit", "50"],
      ["offset", "50"],
    ]);
  });
});

describe("/pieces loader: paging past the data (plan §2.2 rule 8)", () => {
  it("serves the last page", async () => {
    const answer = (await load("?page=5")) as { list: { data: unknown[] } };
    expect(answer.list.data).toHaveLength(49);
  });

  it("sends a page past the end to the last page with a 302", async () => {
    expect(await redirectOf("?page=6")).toEqual({
      status: 302,
      location: "/pieces?page=5",
    });
  });

  it("sends any page of an empty list to the first", async () => {
    expect(await redirectOf("?q=zzzzqqq&page=3")).toEqual({
      status: 302,
      location: "/pieces?q=zzzzqqq",
    });
  });

  it("sends a page past the API to the last page in one hop, asking only for the total", async () => {
    const seen = upstreamRequests();
    expect(await redirectOf("?page=999")).toEqual({
      status: 302,
      location: "/pieces?page=5",
    });
    expect(seen.map(params => params.toString())).toEqual(["limit=1&offset=0"]);
  });

  it("keeps the filters on the way", async () => {
    expect(await redirectOf("?letter=T&page=300")).toEqual({
      status: 302,
      location: "/pieces?letter=T",
    });
  });

  it("shows the failure when even the total can't be had", async () => {
    quietErrors();
    fixtures.fail({ operationId: "listPieces", status: 500, code: "internal" });
    const answer = await load("?page=999");
    expect(answer).toMatchObject({
      type: "DataWithResponseInit",
      data: { kind: "server" },
      init: { status: 500 },
    });
  });
});

describe("/pieces loader: every listPieces failure (plan §3.3)", () => {
  it("returns invalid_filters (400) for the API's 400 to filters it knows, keeping the state", async () => {
    quietErrors();
    fixtures.fail({
      operationId: "listPieces",
      status: 400,
      code: "invalid_request",
      match: { kind: "poem" },
    });
    const answer = await load("?kind=poem");
    expect(answer).toMatchObject({
      type: "DataWithResponseInit",
      data: { failure: { kind: "invalid_filters" }, list: null },
      init: { status: 400 },
    });
  });

  it("returns search_timeout (500) for a 500 with q or a filter", async () => {
    quietErrors();
    fixtures.fail({
      operationId: "listPieces",
      status: 500,
      code: "internal",
      match: { q: "kettle" },
    });
    expect(await load("?q=kettle")).toMatchObject({
      data: { failure: { kind: "search_timeout" }, state: { q: "kettle" } },
      init: { status: 500 },
    });
  });

  it.each([
    ["the plain A–Z", ""],
    ["a letter page", "?letter=T"],
  ])("throws server (500) for a 500 on %s", async (_why, search) => {
    quietErrors();
    fixtures.fail({ operationId: "listPieces", status: 500, code: "internal" });
    expect(await load(search)).toMatchObject({
      data: { kind: "server" },
      init: { status: 500 },
    });
  });

  it("throws resting (503, Retry-After 60) for a proxy's 503", async () => {
    quietErrors();
    await outage({ letter: "T" });
    const answer = (await load("?letter=T")) as {
      data: unknown;
      init: { status: number; headers: Headers };
    };
    expect(answer.data).toEqual({ kind: "resting", retryAfter: 60 });
    expect(answer.init.status).toBe(503);
    expect(answer.init.headers.get("Retry-After")).toBe("60");
  });

  it("throws resting (503, Retry-After 30) for a network failure", async () => {
    quietErrors();
    fixtures.server.use(http.get(PIECES, () => HttpResponse.error()));
    const answer = (await load("")) as {
      init: { status: number; headers: Headers };
    };
    expect(answer.init.status).toBe(503);
    expect(answer.init.headers.get("Retry-After")).toBe("30");
  });

  it("throws resting (503) for a timeout", async () => {
    quietErrors();
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() => timeout(20));
    fixtures.server.use(
      http.get(PIECES, async () => {
        await delay("infinite");
        return HttpResponse.error();
      })
    );
    expect(await load("")).toMatchObject({
      data: { kind: "resting" },
      init: { status: 503 },
    });
  });

  it("throws bad_gateway (502) for a malformed body", async () => {
    quietErrors();
    fixtures.server.use(
      http.get(PIECES, () =>
        offContractResponse(
          "listPieces",
          200,
          { data: [] },
          "no total or facets"
        )
      )
    );
    expect(await load("")).toMatchObject({
      data: { kind: "bad_gateway" },
      init: { status: 502 },
    });
  });
});

describe("/pieces document", () => {
  it("is the A–Z of every piece, titled, described and canonical", async () => {
    const response = await get("/pieces");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache");
    const html = await response.text();
    expect(html).toContain("<title>Pieces · Bardic Torch</title>");
    expect(html).toMatch(
      /<link rel="canonical" href="https:\/\/app\.test\/pieces"\/?>/
    );
    expect(html).not.toContain('name="robots"');
    const main = mainOf(html);
    expect(main).toMatch(/<h1[^>]*>Pieces<\/h1>/);
    expect(main).toContain("249 pieces");
    expect(main).toContain('aria-label="Pieces by letter"');
    expect(main).toContain('href="/pieces/1588-armada-ballad"');
    expect(main).toContain('href="/pieces?page=2"');
    expect(main).toContain('rel="next"');
  });

  it("answers an order-only difference 200, naming the ordered form canonical", async () => {
    const response = await get("/pieces?letter=T&q=lament");
    expect(response.status).toBe(200);
    expect(await response.text()).toMatch(
      /<link rel="canonical" href="https:\/\/app\.test\/pieces\?q=lament&amp;letter=T"\/?>/
    );
  });

  it("indexes a letter page, and keeps a search out of the index", async () => {
    const letter = await (await get("/pieces?letter=T")).text();
    expect(letter).toContain("<title>Pieces under T · Bardic Torch</title>");
    expect(letter).not.toContain('name="robots"');
    const search = await (await get("/pieces?q=kettle")).text();
    expect(search).toContain(
      "<title>Pieces matching ‘kettle’ · Bardic Torch</title>"
    );
    expect(search).toContain('<meta name="robots" content="noindex, follow"/>');
    expect(search).toMatch(
      /<link rel="canonical" href="https:\/\/app\.test\/pieces\?q=kettle"\/?>/
    );
  });

  it("redirects a non-canonical URL before rendering anything", async () => {
    const response = await get("/pieces?letter=t&utm_source=x");
    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe("/pieces?letter=T");
  });

  it("is the filters page (400) for the API's 400, with the search box kept", async () => {
    quietErrors();
    fixtures.fail({
      operationId: "listPieces",
      status: 400,
      code: "invalid_request",
      match: { q: "kettle" },
    });
    const response = await get("/pieces?term=warlike&q=kettle");
    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toContain(
      "<title>We couldn’t apply these filters · Bardic Torch</title>"
    );
    expect(html).toContain('<meta name="robots" content="noindex"/>');
    const main = mainOf(html);
    expect(main).toMatch(/<h1[^>]*>We couldn’t apply these filters<\/h1>/);
    expect(main).toContain('name="q"');
    expect(main).toContain('value="warlike"');
    expect(main).toContain("Remove </span>Mood: Warlike");
    expect(main).toContain("Clear all filters");
    expect(main).not.toContain("unknown term");
  });

  it("is the slow-search page (500) for a 500 to a search, with the search box kept", async () => {
    quietErrors();
    fixtures.fail({
      operationId: "listPieces",
      status: 500,
      code: "internal",
      match: { q: "slow" },
    });
    const response = await get("/pieces?q=slow");
    expect(response.status).toBe(500);
    const main = mainOf(await response.text());
    expect(main).toMatch(/<h1[^>]*>That search took too long<\/h1>/);
    expect(main).toContain('value="slow"');
    expect(main).toContain("Try again");
  });

  it("is the server error (500) inside the shell for a 500 on the A–Z", async () => {
    quietErrors();
    fixtures.fail({ operationId: "listPieces", status: 500, code: "internal" });
    const response = await get("/pieces");
    expect(response.status).toBe(500);
    const html = await response.text();
    expect(html).toContain(
      "<title>We couldn’t load the pieces · Bardic Torch</title>"
    );
    expect(html).toContain('aria-label="Site"');
    expect(mainOf(html)).toMatch(/<h1[^>]*>We couldn’t load the pieces<\/h1>/);
  });

  it("is a 502 for an answer it can't read", async () => {
    quietErrors();
    fixtures.server.use(
      http.get(PIECES, () => new HttpResponse("<html>", { status: 200 }))
    );
    const response = await get("/pieces");
    expect(response.status).toBe(502);
    expect(mainOf(await response.text())).toContain(
      "We got an unexpected answer from our servers."
    );
  });

  it.each([
    ["signed out", undefined, "private, no-cache"],
    ["signed in", "in", "no-store"],
  ])(
    "is the resting page (503) for an outage, with Retry-After, %s",
    async (_who, who, cacheControl) => {
      quietErrors();
      await outage({ letter: "W" });
      const response = await get(
        "/pieces?letter=W",
        who ? await signedIn() : undefined
      );
      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBe("60");
      expect(response.headers.get("Cache-Control")).toBe(cacheControl);
      const html = await response.text();
      expect(html).toContain(
        "<title>Bardic Torch is resting · Bardic Torch</title>"
      );
      expect(html).toContain('<meta name="robots" content="noindex"/>');
      // Inside the shell, the reload link working without JS.
      expect(html).toContain('aria-label="Site"');
      expect(mainOf(html)).toMatch(
        /<a[^>]*href="\/pieces\?letter=W"[^>]*>.*Try again/
      );
    }
  );

  it("is the resting page with Retry-After 30 when the API can't be reached", async () => {
    quietErrors();
    fixtures.server.use(http.get(PIECES, () => HttpResponse.error()));
    const response = await get("/pieces");
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("30");
  });

  it("sends the API no Authorization or Cookie, signed in", async () => {
    const seen: Headers[] = [];
    fixtures.server.events.on("request:start", ({ request }) => {
      if (new URL(request.url).pathname === "/v1/pieces") {
        seen.push(request.headers);
      }
    });
    const response = await get("/pieces?letter=T", await signedIn());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(seen).toHaveLength(1);
    expect(seen[0]?.get("Authorization")).toBeNull();
    expect(seen[0]?.get("Cookie")).toBeNull();
  });
});

describe("/pieces data requests", () => {
  /**
   * A client navigation's `.data` request. Try again revalidates the root
   * too (its loader runs again for the same URL), so its Cache-Control
   * applies; a plain navigation leaves the root out, as on every page.
   */
  const data = (search: string, routes = `root,${ROUTE}`) =>
    `/pieces.data?${new URLSearchParams([
      ...new URLSearchParams(search),
      ["_routes", routes],
    ])}`;

  it("answers a canonical URL without redirecting for React Router's own parameters", async () => {
    const response = await get(data("letter=T", ROUTE));
    expect(response.status).toBe(200);
    const results = await singleFetchResults(response);
    expect(results[ROUTE]).toMatchObject({
      data: { state: { letter: "T" }, canonical: "?letter=T" },
    });
  });

  it.each([
    ["signed out", undefined, "private, no-cache"],
    ["signed in", "in", "no-store"],
  ])(
    "is the resting failure with Retry-After, %s",
    async (_who, who, cacheControl) => {
      quietErrors();
      await outage({ letter: "Y" });
      const response = await get(
        data("letter=Y"),
        who ? await signedIn() : undefined
      );
      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBe("60");
      expect(response.headers.get("Cache-Control")).toBe(cacheControl);
      const results = await singleFetchResults(response);
      expect(results[ROUTE]).toMatchObject({
        error: { status: 503, data: { kind: "resting" } },
      });
    }
  );
});

// ---------------------------------------------------------------------------
// C2.2: the terms beside the pieces, and stale categories (plan §2.4)

/** Every fixture API request's path and query, in the order they started. */
function apiRequests() {
  const seen: string[] = [];
  fixtures.server.events.on("request:start", ({ request }) => {
    const url = new URL(request.url);
    seen.push(`${url.pathname}${url.search}`);
  });
  return seen;
}

describe("/pieces loader: the terms and stale categories (plan §2.4)", () => {
  it("asks for the terms and the pieces together, once each", async () => {
    const seen = apiRequests();
    const answer = (await load("?term=eerie")) as {
      terms: readonly { slug: string }[];
      stale: readonly string[];
    };
    expect([...seen].sort()).toEqual([
      "/v1/pieces?term=eerie&limit=50&offset=0",
      "/v1/terms",
    ]);
    // Both are asked before either has answered.
    expect(seen).toHaveLength(2);
    expect(answer.terms.some(term => term.slug === "eerie")).toBe(true);
    expect(answer.stale).toEqual([]);
  });

  it.each([
    ["an unknown slug", "no-such-term"],
    ["an unapproved term", "draft-topic"],
    ["an affiliation", "northmarch"],
  ])(
    "leaves out %s with one more request, keeping the rest",
    async (_why, slug) => {
      quietErrors();
      const seen = upstreamRequests();
      const answer = (await load(`?term=${slug}&term=warlike&kind=song`)) as {
        state: { term: readonly string[]; kind: readonly string[] };
        canonical: string;
        stale: readonly string[];
        failure: null;
        list: { total: number };
      };
      expect(answer.stale).toEqual([slug]);
      expect(answer.state.term).toEqual(["warlike"]);
      expect(answer.state.kind).toEqual(["song"]);
      expect(answer.failure).toBeNull();
      expect(answer.list.total).toBeGreaterThan(0);
      // The canonical link stays the one asked for (self canonical).
      expect(answer.canonical).toContain(`term=${slug}`);
      expect(seen.map(params => params.getAll("term"))).toEqual([
        [slug, "warlike"].sort(),
        ["warlike"],
      ]);
    }
  );

  it("is the filters page (400) when the 400 persists after the cleaning", async () => {
    quietErrors();
    fixtures.fail({
      operationId: "listPieces",
      status: 400,
      code: "invalid_request",
      match: { kind: "poem" },
      times: 2,
    });
    const seen = upstreamRequests();
    expect(await load("?term=gone&kind=poem")).toMatchObject({
      data: {
        failure: { kind: "invalid_filters" },
        stale: ["gone"],
        state: { term: [], kind: ["poem"] },
      },
      init: { status: 400 },
    });
    expect(seen).toHaveLength(2);
  });

  it("is the filters page (400) when every slug is known: no second request", async () => {
    quietErrors();
    fixtures.fail({
      operationId: "listPieces",
      status: 400,
      code: "invalid_request",
      match: { term: "warlike" },
    });
    const seen = upstreamRequests();
    expect(await load("?term=warlike")).toMatchObject({
      data: { failure: { kind: "invalid_filters" }, stale: [] },
      init: { status: 400 },
    });
    expect(seen).toHaveLength(1);
  });

  it("is the filters page (400) without the terms, with nothing to clean by", async () => {
    quietErrors();
    fixtures.fail({ operationId: "listTerms", status: 500, code: "internal" });
    const seen = upstreamRequests();
    expect(await load("?term=no-such-term")).toMatchObject({
      data: { failure: { kind: "invalid_filters" }, terms: null, stale: [] },
      init: { status: 400 },
    });
    expect(seen).toHaveLength(1);
  });

  it.each([
    [
      "a 500",
      () =>
        fixtures.fail({
          operationId: "listTerms",
          status: 500,
          code: "internal",
        }),
    ],
    [
      "a 400",
      () =>
        fixtures.fail({
          operationId: "listTerms",
          status: 400,
          code: "invalid_request",
        }),
    ],
    [
      "a network failure",
      () =>
        fixtures.server.use(
          http.get(`${API_BASE_URL}/v1/terms`, () => HttpResponse.error())
        ),
    ],
    [
      "a malformed body",
      () =>
        fixtures.server.use(
          http.get(`${API_BASE_URL}/v1/terms`, () =>
            offContractResponse("listTerms", 200, {}, "no data")
          )
        ),
    ],
  ])(
    "shows the pieces when the terms fail with %s",
    async (_why, failTerms) => {
      quietErrors();
      failTerms();
      const answer = (await load("?letter=T")) as {
        terms: null;
        failure: null;
        list: { total: number };
      };
      expect(answer.terms).toBeNull();
      expect(answer.failure).toBeNull();
      expect(answer.list.total).toBe(5);
    }
  );

  it("follows the pieces' failure whatever the terms did", async () => {
    quietErrors();
    fixtures.fail({ operationId: "listTerms", status: 500, code: "internal" });
    await outage({ letter: "V" });
    expect(await load("?letter=V")).toMatchObject({
      data: { kind: "resting" },
      init: { status: 503 },
    });
  });

  it("cleans the total's request too, for a page past the API", async () => {
    quietErrors();
    expect(await redirectOf("?term=no-such-term&term=eerie&page=500")).toEqual({
      status: 302,
      location: "/pieces?term=eerie",
    });
  });

  it.each(["?stub=", "?kind=song&stub=&sort=", "?q=lament&sort="])(
    "answers %s, the facet form's empty defaults, without a redirect",
    async search => {
      expect(await redirectOf(search)).toBeNull();
    }
  );
});

describe("/pieces document: facets and stale categories", () => {
  it("has the facet column with its groups and counts", async () => {
    const main = mainOf(await (await get("/pieces?kind=poem")).text());
    expect(main).toContain('id="filters"');
    expect(main).toMatch(/<legend[^>]*>Kind<\/legend>/);
    expect(main).toMatch(/<legend[^>]*>Mood<\/legend>/);
    expect(main).toMatch(/<legend[^>]*>Conservation status<\/legend>/);
    expect(main).toMatch(/<legend[^>]*>Page state<\/legend>/);
    expect(main).toContain("Apply filters");
    expect(main).toContain("Remove </span>Kind: Poem");
    // Before hydration (and without JS) the Filters link jumps to the
    // column after the results; the drawer comes with JS.
    expect(main).toMatch(
      /<a[^>]*href="#filters"[^>]*>.*?Filters \(1 selected\)/
    );
    expect(main).not.toContain("<dialog");
  });

  it("names the categories it left out, noindex with a self canonical", async () => {
    quietErrors();
    const response = await get("/pieces?term=no-such-term&term=eerie");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('<meta name="robots" content="noindex, follow"/>');
    expect(html).toMatch(
      /<link rel="canonical" href="https:\/\/app\.test\/pieces\?term=eerie&amp;term=no-such-term"\/?>/
    );
    expect(mainOf(html)).toContain(
      "Some categories in this link no longer exist, so we left them out: ‘no-such-term’."
    );
    expect(mainOf(html)).toContain("Remove </span>Mood: Eerie");
    expect(mainOf(html)).not.toContain("Category: no-such-term");
  });

  it("keeps a filtered list out of the index, naming itself canonical", async () => {
    const html = await (await get("/pieces?kind=poem&term=eerie")).text();
    expect(html).toContain('<meta name="robots" content="noindex, follow"/>');
    expect(html).toMatch(
      /<link rel="canonical" href="https:\/\/app\.test\/pieces\?term=eerie&amp;kind=poem"\/?>/
    );
  });

  it("says the categories failed in the column, and still lists the pieces", async () => {
    quietErrors();
    fixtures.fail({ operationId: "listTerms", status: 500, code: "internal" });
    const response = await get("/pieces?letter=T");
    expect(response.status).toBe(200);
    const main = mainOf(await response.text());
    expect(main).toContain("We couldn’t load the categories");
    expect(main).toContain("Þorvald’s Lament");
  });

  it("is the filters page with the categories' error when both fail", async () => {
    quietErrors();
    fixtures.fail({ operationId: "listTerms", status: 500, code: "internal" });
    const response = await get("/pieces?term=no-such-term");
    expect(response.status).toBe(400);
    const main = mainOf(await response.text());
    expect(main).toMatch(/<h1[^>]*>We couldn’t apply these filters<\/h1>/);
    expect(main).toContain("We couldn’t load the categories");
    expect(main).toContain("Remove </span>Category: no-such-term");
  });
});
