import { delay, http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  API_BASE_URL,
  routeArgs,
  sessionCookie,
  sessionTokens,
} from "~/test/context";
import { serveFixtureApi } from "~/test/msw";
import { serveApp } from "~/test/server-build";
import * as bardsModule from "./bards._index";

// /bards against the fixture API through msw: the loader (the canonical
// and paging redirects, the stale affiliation's re-query, every failure of
// listPersons and of listTerms), and the documents.

const fixtures = serveFixtureApi();
const get = serveApp([
  {
    id: "routes/bards._index",
    path: "bards",
    module: bardsModule,
    hasLoader: true,
    hasErrorBoundary: true,
  },
]);

const PERSONS = `${API_BASE_URL}/v1/persons`;
const TERMS = `${API_BASE_URL}/v1/terms`;

afterEach(() => {
  vi.restoreAllMocks();
});

function quietErrors() {
  return vi.spyOn(console, "error").mockImplementation(() => undefined);
}

function upstreamRequests(pathname: string) {
  const seen: URLSearchParams[] = [];
  fixtures.server.events.on("request:start", ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname === pathname) seen.push(url.searchParams);
  });
  return seen;
}

async function load(search: string): Promise<unknown> {
  try {
    return await bardsModule.loader(
      routeArgs(new Request(`https://app.test/bards${search}`), {
        pattern: "/bards",
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

async function outage(match: Readonly<Record<string, string>>) {
  const response = await fetch(`${API_BASE_URL}/__fixtures/outage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operationId: "listPersons", match, mode: "503" }),
  });
  expect(response.ok).toBe(true);
}

const mainOf = (html: string) =>
  html.slice(html.indexOf('<main id="content"'), html.indexOf("</main>"));

describe("/bards loader", () => {
  it("lists the persons and the affiliation terms, asking for both at once", async () => {
    const terms = upstreamRequests("/v1/terms");
    const answer = (await load("?letter=W")) as {
      list: { data: { slug: string }[] };
      affiliations: { slug: string }[];
      staleAffiliation: boolean;
    };
    expect(answer.list.data.map(person => person.slug)).toEqual([
      "wren-of-the-vale",
      "wynne-of-caer-wyn",
    ]);
    expect(answer.affiliations.map(term => term.slug)).toEqual([
      "northmarch",
      "barony-of-ashdown",
      "westerfell",
      "shire-of-greywater",
      "caer-wyn",
    ]);
    expect(answer.staleAffiliation).toBe(false);
    expect(terms.map(params => params.toString())).toEqual([
      "facet=affiliation",
    ]);
  });

  it("lists a person with no page as a stub, like any other", async () => {
    const answer = (await load("?letter=H")) as {
      list: { data: { slug: string; is_stub: boolean }[] };
    };
    expect(answer.list.data).toContainEqual(
      expect.objectContaining({ slug: "hollis-fenn", is_stub: true })
    );
  });

  it.each([
    ["an unknown parameter", "?utm_source=x&letter=W", "/bards?letter=W"],
    ["a lower-case letter", "?letter=w", "/bards?letter=W"],
    ["the default order", "?sort=name", "/bards"],
  ])("redirects %s with one 301", async (_why, search, location) => {
    expect(await redirectOf(search)).toEqual({ status: 301, location });
  });

  it("sends a page past the end to the last page", async () => {
    expect(await redirectOf("?page=2")).toEqual({
      status: 302,
      location: "/bards",
    });
  });

  it("leaves out an affiliation that no longer exists, with one re-query", async () => {
    const seen = upstreamRequests("/v1/persons");
    const answer = (await load("?affiliation=gone-kingdom&kind=group")) as {
      state: { affiliation?: string; kind: string[] };
      list: { total: number };
      staleAffiliation: boolean;
    };
    expect(answer.staleAffiliation).toBe(true);
    // The page shows, and links from, the state it asked for.
    expect(answer.state.affiliation).toBeUndefined();
    expect(answer.state.kind).toEqual(["group"]);
    expect(answer.list.total).toBeGreaterThan(0);
    expect(seen.map(params => params.toString())).toEqual([
      "kind=group&affiliation=gone-kingdom&limit=50&offset=0",
      "kind=group&limit=50&offset=0",
    ]);
  });

  it("is the filters failure (400) for a 400 it can't clean: the terms didn't load", async () => {
    quietErrors();
    fixtures.fail({ operationId: "listTerms", status: 500, code: "internal" });
    expect(await load("?affiliation=gone-kingdom")).toMatchObject({
      type: "DataWithResponseInit",
      data: { failure: { kind: "invalid_filters" }, affiliations: null },
      init: { status: 400 },
    });
  });

  it.each([
    ["a 500", 500, "internal"],
    ["a 400", 400, "invalid_request"],
  ] as const)(
    "shows the list without the affiliations when only they fail with %s",
    async (_why, status, code) => {
      quietErrors();
      fixtures.fail({ operationId: "listTerms", status, code });
      expect(await load("?letter=W")).toMatchObject({
        failure: null,
        affiliations: null,
        list: { total: 2 },
      });
    }
  );

  it("is search_timeout (500) for a 500 with q or a filter, and server for the plain A–Z", async () => {
    quietErrors();
    fixtures.fail({
      operationId: "listPersons",
      status: 500,
      code: "internal",
      match: { q: "slow" },
    });
    expect(await load("?q=slow")).toMatchObject({
      data: { failure: { kind: "search_timeout" } },
      init: { status: 500 },
    });
    fixtures.fail({
      operationId: "listPersons",
      status: 500,
      code: "internal",
    });
    expect(await load("?letter=W")).toMatchObject({
      data: { kind: "server" },
      init: { status: 500 },
    });
  });

  it("is resting (503) for an outage, a network failure or a timeout", async () => {
    quietErrors();
    await outage({ letter: "W" });
    expect(await load("?letter=W")).toMatchObject({
      data: { kind: "resting", retryAfter: 60 },
      init: { status: 503 },
    });
    fixtures.server.use(http.get(PERSONS, () => HttpResponse.error()));
    expect(await load("")).toMatchObject({
      data: { kind: "resting", retryAfter: 30 },
    });
    fixtures.server.resetHandlers();
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() => timeout(20));
    fixtures.server.use(
      http.get(PERSONS, async () => {
        await delay("infinite");
        return HttpResponse.error();
      })
    );
    expect(await load("")).toMatchObject({ data: { kind: "resting" } });
  });

  it("is bad_gateway (502) for a malformed body, and the terms' malformed body only loses the select", async () => {
    quietErrors();
    fixtures.server.use(
      http.get(TERMS, () => new HttpResponse("not JSON", { status: 200 }))
    );
    expect(await load("?letter=W")).toMatchObject({ affiliations: null });
    fixtures.server.use(
      http.get(PERSONS, () => new HttpResponse("not JSON", { status: 200 }))
    );
    expect(await load("")).toMatchObject({
      data: { kind: "bad_gateway" },
      init: { status: 502 },
    });
  });
});

describe("/bards document", () => {
  it("is the A–Z of every bard, titled and canonical", async () => {
    const response = await get("/bards?letter=W");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("<title>Bards under W · Bardic Torch</title>");
    expect(html).toMatch(
      /<link rel="canonical" href="https:\/\/app\.test\/bards\?letter=W"\/?>/
    );
    expect(html).not.toContain('name="robots"');
    const main = mainOf(html);
    expect(main).toMatch(/<h1[^>]*>Bards<\/h1>/);
    expect(main).toContain('href="/bards/wren-of-the-vale"');
    expect(main).toContain('aria-label="Bards by letter"');
    expect(main).toContain("Filters");
  });

  it("keeps a filtered list, and a stale affiliation's, out of the index", async () => {
    const filtered = await (await get("/bards?kind=group")).text();
    expect(filtered).toContain(
      '<meta name="robots" content="noindex, follow"/>'
    );
    const stale = await (await get("/bards?affiliation=gone-kingdom")).text();
    expect(stale).toContain('<meta name="robots" content="noindex, follow"/>');
    expect(mainOf(stale)).toContain(
      "That affiliation no longer exists, so we left it out."
    );
    // No chip, letter or page link carries it on to the next request.
    expect(mainOf(stale)).not.toContain("gone-kingdom");
    expect(mainOf(stale)).toContain("All bards");
  });

  it("answers the filter form's own GET in DOM order with 200", async () => {
    // Hidden q and letter first, then the boxes and the select.
    const response = await get(
      "/bards?q=wren&letter=W&kind=community_bard&role=singer&affiliation=barony-of-ashdown"
    );
    expect(response.status).toBe(200);
  });

  it.each([
    ["signed out", undefined, "private, no-cache"],
    ["signed in", "in", "no-store"],
  ])(
    "is the resting page (503) with Retry-After, %s",
    async (_who, who, cacheControl) => {
      quietErrors();
      await outage({ letter: "Y" });
      const response = await get(
        "/bards?letter=Y",
        who
          ? await sessionCookie(
              sessionTokens({ accessToken: "fixture:contributor" })
            )
          : undefined
      );
      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBe("60");
      expect(response.headers.get("Cache-Control")).toBe(cacheControl);
    }
  );

  it("is the slow-search page (500) for a 500 to a search, keeping the search box", async () => {
    quietErrors();
    fixtures.fail({
      operationId: "listPersons",
      status: 500,
      code: "internal",
      match: { q: "slowest" },
    });
    const response = await get("/bards?q=slowest");
    expect(response.status).toBe(500);
    const main = mainOf(await response.text());
    expect(main).toMatch(/<h1[^>]*>That search took too long<\/h1>/);
    expect(main).toContain('value="slowest"');
  });

  it("is the server error (500) inside the shell for a 500 on the A–Z", async () => {
    quietErrors();
    fixtures.fail({
      operationId: "listPersons",
      status: 500,
      code: "internal",
    });
    const response = await get("/bards");
    expect(response.status).toBe(500);
    expect(await response.text()).toContain(
      "<title>We couldn’t load the bards · Bardic Torch</title>"
    );
  });
});
