import { http, HttpResponse } from "msw";
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
import * as searchModule from "./search";

// /search against the fixture API through msw: the loader (the canonical
// q, the three parallel reads, each failing on its own, and the page's
// failure when all three do), and the documents it makes.

const fixtures = serveFixtureApi();
const get = serveApp([
  {
    id: "routes/search",
    path: "search",
    module: searchModule,
    hasLoader: true,
    hasErrorBoundary: true,
  },
]);

const PIECES = `${API_BASE_URL}/v1/pieces`;
const PERSONS = `${API_BASE_URL}/v1/persons`;
const TERMS = `${API_BASE_URL}/v1/terms`;

afterEach(() => {
  vi.restoreAllMocks();
});

function quietErrors() {
  return vi.spyOn(console, "error").mockImplementation(() => undefined);
}

async function load(search: string): Promise<unknown> {
  try {
    return await searchModule.loader(
      routeArgs(new Request(`https://app.test/search${search}`), {
        pattern: "/search",
      })
    );
  } catch (thrown) {
    return thrown;
  }
}

function apiRequests() {
  const seen: string[] = [];
  fixtures.server.events.on("request:start", ({ request }) => {
    const url = new URL(request.url);
    seen.push(`${url.pathname}${url.search}`);
  });
  return seen;
}

function mainOf(html: string): string {
  return html.slice(
    html.indexOf('<main id="content"'),
    html.indexOf("</main>")
  );
}

/** Make the fixture API answer `operationId` like a proxy whose backend is down. */
async function outage(
  operationId: string,
  match: Readonly<Record<string, string>>
) {
  const response = await fetch(`${API_BASE_URL}/__fixtures/outage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operationId, match, mode: "503" }),
  });
  expect(response.ok).toBe(true);
}

type Loaded = {
  q: string;
  pieces: { ok: boolean; data?: { total: number }; failure?: unknown };
  persons: { ok: boolean; data?: { total: number }; failure?: unknown };
  terms: {
    ok: boolean;
    data?: { total: number; shown: readonly { slug: string }[] };
    failure?: unknown;
  };
};

describe("/search loader", () => {
  it.each([
    ["?q=+kettle+", "/search?q=kettle"],
    ["?q=", "/search"],
    ["?q=a&q=b", "/search?q=a"],
    ["?utm_source=x&q=kettle", "/search?q=kettle"],
  ])(
    "redirects %s to its canonical form with a 301",
    async (search, location) => {
      const answer = await load(search);
      expect(answer).toBeInstanceOf(Response);
      expect((answer as Response).status).toBe(301);
      expect((answer as Response).headers.get("Location")).toBe(location);
    }
  );

  it("calls nothing without a search", async () => {
    const seen = apiRequests();
    expect(await load("")).toEqual({ q: undefined });
    expect(seen).toEqual([]);
  });

  it("reads the pieces, the bards and the terms together", async () => {
    const seen = apiRequests();
    const answer = (await load("?q=northmarch")) as Loaded;
    expect([...seen].sort()).toEqual([
      "/v1/persons?q=northmarch&limit=10",
      "/v1/pieces?q=northmarch&limit=10",
      "/v1/terms",
    ]);
    expect(answer.pieces.data?.total).toBe(1);
    expect(answer.persons.data?.total).toBe(1);
    expect(answer.terms.data?.shown.map(term => term.slug)).toContain(
      "northmarch"
    );
  });

  it.each([
    [
      "pieces",
      "a 500 (a search too slow)",
      () =>
        fixtures.fail({
          operationId: "listPieces",
          status: 500,
          code: "internal",
          match: { q: "northmarch" },
        }),
      { kind: "search_timeout" },
    ],
    [
      "persons",
      "a 500 (a search too slow)",
      () =>
        fixtures.fail({
          operationId: "listPersons",
          status: 500,
          code: "internal",
          match: { q: "northmarch" },
        }),
      { kind: "search_timeout" },
    ],
    [
      "terms",
      "a 500",
      () =>
        fixtures.fail({
          operationId: "listTerms",
          status: 500,
          code: "internal",
        }),
      { kind: "server" },
    ],
    [
      "pieces",
      "a network failure",
      () => fixtures.server.use(http.get(PIECES, () => HttpResponse.error())),
      { kind: "resting", retryAfter: 30 },
    ],
    [
      "persons",
      "a malformed body",
      () =>
        fixtures.server.use(
          http.get(PERSONS, () =>
            offContractResponse(
              "listPersons",
              200,
              { data: [] },
              "no total or letters"
            )
          )
        ),
      { kind: "bad_gateway" },
    ],
    [
      "persons",
      "a 400",
      () =>
        fixtures.fail({
          operationId: "listPersons",
          status: 400,
          code: "invalid_request",
          match: { q: "northmarch" },
        }),
      { kind: "invalid_filters" },
    ],
  ] as const)(
    "keeps the other sections when the %s fail with %s",
    async (section, _how, failIt, failure) => {
      quietErrors();
      failIt();
      const answer = (await load("?q=northmarch")) as Loaded;
      expect(answer[section]).toEqual({ ok: false, failure });
      const others = (["pieces", "persons", "terms"] as const).filter(
        other => other !== section
      );
      for (const other of others) expect(answer[other].ok).toBe(true);
    }
  );

  it("handles a proxy's 503 on one section on its own", async () => {
    quietErrors();
    await outage("listPersons", { q: "northmarch" });
    const answer = (await load("?q=northmarch")) as Loaded;
    expect(answer.persons).toEqual({
      ok: false,
      failure: { kind: "resting", retryAfter: 60 },
    });
    expect(answer.pieces.ok).toBe(true);
  });

  it("is the resting page (503) when all three are outages", async () => {
    quietErrors();
    fixtures.server.use(
      http.get(PIECES, () => new HttpResponse("down", { status: 503 })),
      http.get(PERSONS, () => HttpResponse.error()),
      http.get(TERMS, () => new HttpResponse("down", { status: 503 }))
    );
    expect(await load("?q=northmarch")).toMatchObject({
      data: { kind: "resting", retryAfter: 60 },
      init: { status: 503 },
    });
  });

  it("is a server error (500) when all three fail otherwise", async () => {
    quietErrors();
    fixtures.server.use(
      http.get(PIECES, () => new HttpResponse("down", { status: 503 })),
      http.get(PERSONS, () =>
        offContractResponse("listPersons", 200, {}, "empty")
      ),
      http.get(TERMS, () => HttpResponse.error())
    );
    expect(await load("?q=northmarch")).toMatchObject({
      data: { kind: "server" },
      init: { status: 500 },
    });
  });
});

describe("/search document", () => {
  it("is the empty search page without q: no call, noindex", async () => {
    const seen = apiRequests();
    const response = await get("/search");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("<title>Search · Bardic Torch</title>");
    expect(html).toContain('<meta name="robots" content="noindex, follow"/>');
    expect(mainOf(html)).toContain(
      "Type a word from a title, a name or a category."
    );
    expect(seen).toEqual([]);
  });

  it("lists the pieces, bards and categories for a search", async () => {
    const response = await get("/search?q=northmarch");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache");
    const html = await response.text();
    expect(html).toContain("<title>Search: northmarch · Bardic Torch</title>");
    expect(html).toContain('<meta name="robots" content="noindex, follow"/>');
    expect(html).toMatch(
      /<link rel="canonical" href="https:\/\/app\.test\/search\?q=northmarch"\/?>/
    );
    const main = mainOf(html);
    expect(main).toContain('value="northmarch"');
    expect(main).toContain("Northmarch Rising");
    expect(main).toContain('href="/bards/');
    expect(main).toContain("Northmarch Bards");
    expect(main).toContain('href="/categories/northmarch"');
    expect(main).toContain("1 piece, 1 bard and ");
  });

  it("links to every piece of a long search", async () => {
    const main = mainOf(await (await get("/search?q=drill")).text());
    expect(main).toContain('href="/pieces?q=drill"');
    expect(main).toContain("See all <!-- -->205 pieces");
  });

  it("says when nothing matches", async () => {
    const main = mainOf(await (await get("/search?q=zzqx-nothing")).text());
    expect(main).toContain("Nothing matches ‘zzqx-nothing’");
    expect(main).toContain("No results");
  });

  it("keeps the page (200) with one section's error", async () => {
    quietErrors();
    fixtures.fail({
      operationId: "listPieces",
      status: 500,
      code: "internal",
      match: { q: "northmarch" },
    });
    const response = await get("/search?q=northmarch");
    expect(response.status).toBe(200);
    const main = mainOf(await response.text());
    expect(main).toContain("That search took too long");
    expect(main).toContain("Northmarch Bards");
  });

  it.each([
    ["signed out", false, "private, no-cache"],
    ["signed in", true, "no-store"],
  ])(
    "is the resting page (503) with Retry-After when everything is down, %s",
    async (_who, signedIn, cacheControl) => {
      quietErrors();
      fixtures.server.use(
        http.get(PIECES, () => HttpResponse.error()),
        http.get(PERSONS, () => HttpResponse.error()),
        http.get(TERMS, () => HttpResponse.error())
      );
      const response = await get(
        "/search?q=northmarch",
        signedIn
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

  it("is the server error (500) inside the shell when everything fails otherwise", async () => {
    quietErrors();
    fixtures.server.use(
      http.get(PIECES, () => new HttpResponse("<html>", { status: 200 })),
      http.get(PERSONS, () => new HttpResponse("<html>", { status: 200 })),
      http.get(TERMS, () => new HttpResponse("<html>", { status: 200 }))
    );
    const response = await get("/search?q=northmarch");
    expect(response.status).toBe(500);
    expect(mainOf(await response.text())).toMatch(
      /<h1[^>]*>We couldn’t load the search results<\/h1>/
    );
  });
});
