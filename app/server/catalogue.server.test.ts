import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, loadContext } from "~/test/context";
import { contractResponse } from "~/test/contract";
import { serveFixtureApi } from "~/test/msw";
import { getPiece, listPieces } from "./catalogue.server";

// The anonymous read client against the fixture API through msw: what it
// sends, and how each upstream answer maps to a ReadFailure.

const fixtures = serveFixtureApi();
const PIECES = `${API_BASE_URL}/v1/pieces`;

const EMPTY_LIST = {
  data: [],
  total: 0,
  facets: { terms: [], kinds: [], conservation_statuses: [], letters: [] },
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("what it sends", () => {
  it("sends Accept, and no Authorization or cookie", async () => {
    const seen: Headers[] = [];
    fixtures.server.use(
      http.get(PIECES, ({ request }) => {
        seen.push(request.headers);
        return contractResponse("listPieces", 200, EMPTY_LIST);
      })
    );
    await listPieces(loadContext(), {});
    expect([...(seen[0]?.keys() ?? [])]).toContain("accept");
    expect(seen[0]?.get("Accept")).toBe("application/json");
    expect(seen[0]?.get("Authorization")).toBeNull();
    expect(seen[0]?.get("Cookie")).toBeNull();
  });

  it("sends the query in the spec's order, whatever the object's", async () => {
    const seen: string[] = [];
    fixtures.server.events.on("request:start", ({ request }) => {
      seen.push(new URL(request.url).search);
    });
    await listPieces(loadContext(), {
      offset: 100,
      limit: 50,
      sort: "title",
      letter: "W",
      q: "a b",
      stub: false,
      conservation_status: ["low_risk"],
      kind: ["poem"],
      term: ["war"],
    });
    expect(seen).toEqual([
      "?term=war&kind=poem&conservation_status=low_risk&stub=false&q=a+b&letter=W&sort=title&limit=50&offset=100",
    ]);
  });
});

describe("how an upstream answer reads", () => {
  // Served through a stubbed fetch, not msw: msw keeps feeding Node's fetch
  // after the timeout aborted it, and Node fails an internal assertion.
  const stalled = () =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"data":'));
        },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  const internal = () =>
    contractResponse("listPieces", 500, { code: "internal", message: "x" });

  it.each([
    [
      "a 400",
      () =>
        contractResponse("listPieces", 400, {
          code: "invalid_request",
          message: "x",
        }),
    ],
    ["a 500", internal],
    [
      "a proxy's plain-text 503",
      () => new HttpResponse("Service Unavailable", { status: 503 }),
    ],
    ["a network failure", () => HttpResponse.error()],
    ["a body that stalls after the headers", stalled],
    [
      "a body that isn't JSON",
      () => new HttpResponse("not JSON", { status: 200 }),
    ],
  ])("%s is a read to try again", async (_why, respond) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() => timeout(20));
    fixtures.server.use(http.get(PIECES, respond));
    if (respond === stalled) vi.stubGlobal("fetch", async () => stalled());
    expect(await listPieces(loadContext(), {})).toEqual({
      ok: false,
      failure: { kind: "try_again" },
    });
  });

  it("a 404 is not_found", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await getPiece(loadContext(), "no-such-piece")).toEqual({
      ok: false,
      failure: { kind: "not_found" },
    });
  });
});
