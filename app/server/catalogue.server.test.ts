import { delay, http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, loadContext } from "~/test/context";
import { contractResponse, offContractResponse } from "~/test/contract";
import { serveFixtureApi } from "~/test/msw";
import { getPiece, listPieces } from "./catalogue.server";

// The anonymous read client against the fixture API through msw: what it
// sends, and how each upstream answer maps to a ReadFailure (plan §3.3).

const fixtures = serveFixtureApi();
const PIECES = `${API_BASE_URL}/v1/pieces`;

const EMPTY_LIST = {
  data: [],
  total: 0,
  facets: { terms: [], kinds: [], conservation_statuses: [], letters: [] },
};

/** Records each listPieces request, answered by `respond`. */
function capture(
  respond: () => Response = () =>
    contractResponse("listPieces", 200, EMPTY_LIST)
) {
  const seen: { readonly url: string; readonly headers: Headers }[] = [];
  fixtures.server.use(
    http.get(PIECES, ({ request }) => {
      seen.push({ url: request.url, headers: request.headers });
      return respond();
    })
  );
  return seen;
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

afterEach(() => {
  vi.restoreAllMocks();
});
function quietErrors() {
  return vi.spyOn(console, "error").mockImplementation(() => undefined);
}

describe("listPieces: what it sends", () => {
  it("sends only Accept: no Authorization, no cookie, whoever is reading", async () => {
    const seen = capture();
    await listPieces(loadContext(), { limit: 50, offset: 0 });
    expect(seen).toHaveLength(1);
    const headers = [...(seen[0]?.headers.keys() ?? [])];
    expect(headers).toContain("accept");
    expect(headers).not.toContain("authorization");
    expect(headers).not.toContain("cookie");
    expect(seen[0]?.headers.get("Accept")).toBe("application/json");
  });

  it.each([
    [{}, ""],
    [{ limit: 50, offset: 0 }, "?limit=50&offset=0"],
    [{ q: "wild heron" }, "?q=wild+heron"],
    [{ term: ["war", "eerie"] }, "?term=war&term=eerie"],
    [{ term: [] }, ""],
    [{ kind: ["song", "poem"] }, "?kind=song&kind=poem"],
    [
      { conservation_status: ["endangered"] },
      "?conservation_status=endangered",
    ],
    [{ stub: true }, "?stub=true"],
    [{ stub: false }, "?stub=false"],
    [{ letter: "0" }, "?letter=0"],
    [{ q: "it’s & more=yes" }, "?q=it%E2%80%99s+%26+more%3Dyes"],
    // The spec's parameter order, whatever the object's.
    [
      {
        offset: 100,
        limit: 50,
        sort: "title",
        letter: "W",
        q: "a",
        stub: false,
        conservation_status: ["low_risk"],
        kind: ["comedy"],
        term: ["war"],
      },
      "?term=war&kind=comedy&conservation_status=low_risk&stub=false&q=a&letter=W&sort=title&limit=50&offset=100",
    ],
  ] as const)("serialises %o as %s", async (query, search) => {
    const seen = capture();
    await listPieces(loadContext(), query);
    expect(new URL(seen[0]?.url ?? "").search).toBe(search);
  });

  it("gives up after 10 seconds", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    capture();
    await listPieces(loadContext(), {});
    expect(timeout).toHaveBeenCalledWith(10_000);
  });
});

describe("listPieces: answers", () => {
  it("reads a page of pieces with its counts", async () => {
    const result = await listPieces(loadContext(), { letter: "T", limit: 50 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.total).toBeGreaterThan(0);
    expect(result.data.data.length).toBe(result.data.total);
    expect(result.data.facets.letters.length).toBeGreaterThan(1);
  });

  it("is invalid_filters for the API's 400, logging its message, never returning it", async () => {
    const logged = quietErrors();
    const result = await listPieces(loadContext(), { term: ["no-such-term"] });
    expect(result).toEqual({ ok: false, failure: { kind: "invalid_filters" } });
    expect(String(logged.mock.calls[0])).toContain(
      "unknown term: no-such-term"
    );
  });

  it("is search_timeout for a 500 to a search", async () => {
    quietErrors();
    fixtures.fail({ operationId: "listPieces", status: 500, code: "internal" });
    expect(await listPieces(loadContext(), { q: "kettle" })).toEqual({
      ok: false,
      failure: { kind: "search_timeout" },
    });
  });

  it("is search_timeout for a 500 to a filter", async () => {
    quietErrors();
    fixtures.fail({ operationId: "listPieces", status: 500, code: "internal" });
    expect(await listPieces(loadContext(), { stub: false })).toEqual({
      ok: false,
      failure: { kind: "search_timeout" },
    });
  });

  it("is server for a 500 to the plain A–Z (letter, sort and paging aren't filters)", async () => {
    quietErrors();
    fixtures.fail({ operationId: "listPieces", status: 500, code: "internal" });
    expect(
      await listPieces(loadContext(), {
        letter: "T",
        limit: 50,
        offset: 50,
        term: [],
      })
    ).toEqual({ ok: false, failure: { kind: "server" } });
  });

  it("is resting (Retry-After 60) for a proxy's plain-text 503", async () => {
    quietErrors();
    await outage({ q: "down" });
    expect(await listPieces(loadContext(), { q: "down" })).toEqual({
      ok: false,
      failure: { kind: "resting", retryAfter: 60 },
    });
  });

  it("is resting (Retry-After 60) for the Error code unavailable", async () => {
    quietErrors();
    capture(() =>
      offContractResponse(
        "listPieces",
        503,
        { code: "unavailable", message: "database down" },
        "listPieces declares no 503 yet (spec issue B1)"
      )
    );
    expect(await listPieces(loadContext(), {})).toEqual({
      ok: false,
      failure: { kind: "resting", retryAfter: 60 },
    });
  });

  it("is resting (Retry-After 30) when the API can't be reached", async () => {
    const logged = quietErrors();
    capture(() => HttpResponse.error());
    expect(await listPieces(loadContext(), {})).toEqual({
      ok: false,
      failure: { kind: "resting", retryAfter: 30 },
    });
    expect(String(logged.mock.calls[0]?.[0])).toBe("listPieces failed:");
  });

  it("is resting (Retry-After 30) when the API is too slow", async () => {
    const logged = quietErrors();
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() => timeout(20));
    fixtures.server.use(
      http.get(PIECES, async () => {
        await delay("infinite");
        return contractResponse("listPieces", 200, EMPTY_LIST);
      })
    );
    expect(await listPieces(loadContext(), {})).toEqual({
      ok: false,
      failure: { kind: "resting", retryAfter: 30 },
    });
    expect(String(logged.mock.calls[0]?.[0])).toBe("listPieces timed out:");
  });

  it.each([
    [
      "a body that breaks the contract",
      () =>
        offContractResponse(
          "listPieces",
          200,
          { ...EMPTY_LIST, next: 2 },
          "PieceList is closed"
        ),
    ],
    [
      "a body that isn't JSON",
      () =>
        new HttpResponse("<html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
    ],
    [
      "a redirect",
      () =>
        new HttpResponse(null, {
          status: 302,
          headers: { Location: "https://elsewhere.test/" },
        }),
    ],
    [
      "a 404 listPieces doesn't declare",
      () =>
        offContractResponse(
          "listPieces",
          404,
          { code: "not_found", message: "no" },
          "listPieces declares no 404"
        ),
    ],
    [
      "a gateway's HTML 502",
      () =>
        new HttpResponse("<h1>Bad gateway</h1>", {
          status: 502,
          headers: { "Content-Type": "text/html" },
        }),
    ],
    [
      "a 500 without an Error body",
      () => new HttpResponse("oops", { status: 500 }),
    ],
  ])("is bad_gateway for %s", async (_why, respond) => {
    quietErrors();
    capture(respond);
    expect(await listPieces(loadContext(), {})).toEqual({
      ok: false,
      failure: { kind: "bad_gateway" },
    });
  });
});

describe("getPiece (C4.1)", () => {
  const PIECE = `${API_BASE_URL}/v1/pieces/:slug`;

  it("asks for the piece by its slug, with nothing but Accept", async () => {
    const seen: { url: string; headers: Headers }[] = [];
    fixtures.server.events.on("request:start", ({ request }) => {
      seen.push({ url: request.url, headers: request.headers });
    });
    const result = await getPiece(loadContext(), "the-copper-kettle");
    expect(result).toMatchObject({
      ok: true,
      data: { slug: "the-copper-kettle", title: "The Copper Kettle" },
    });
    expect(seen.map(({ url }) => url)).toEqual([
      `${API_BASE_URL}/v1/pieces/the-copper-kettle`,
    ]);
    expect(seen[0]?.headers.get("Authorization")).toBeNull();
    expect(seen[0]?.headers.get("Cookie")).toBeNull();
  });

  it("is not_found for the API's 404, and for its 400", async () => {
    quietErrors();
    expect(await getPiece(loadContext(), "no-such-piece")).toEqual({
      ok: false,
      failure: { kind: "not_found" },
    });
    fixtures.server.use(
      http.get(PIECE, () =>
        contractResponse("getPiece", 400, {
          code: "invalid_request",
          message: "bad slug",
        })
      )
    );
    expect(await getPiece(loadContext(), "the-copper-kettle")).toEqual({
      ok: false,
      failure: { kind: "not_found" },
    });
  });

  it("is server for a 500, even though nothing was filtered", async () => {
    quietErrors();
    fixtures.fail({ operationId: "getPiece", status: 500, code: "internal" });
    expect(await getPiece(loadContext(), "the-copper-kettle")).toEqual({
      ok: false,
      failure: { kind: "server" },
    });
  });

  it("is resting for a network failure, and bad_gateway for a body off the contract", async () => {
    quietErrors();
    fixtures.server.use(http.get(PIECE, () => HttpResponse.error()));
    expect(await getPiece(loadContext(), "the-copper-kettle")).toEqual({
      ok: false,
      failure: { kind: "resting", retryAfter: 30 },
    });
    fixtures.server.resetHandlers();
    fixtures.server.use(
      http.get(PIECE, () =>
        offContractResponse("getPiece", 200, { title: 1 }, "not a piece")
      )
    );
    expect(await getPiece(loadContext(), "the-copper-kettle")).toEqual({
      ok: false,
      failure: { kind: "bad_gateway" },
    });
  });
});
