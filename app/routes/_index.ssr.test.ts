import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, routeArgs } from "~/test/context";
import { serveFixtureApi } from "~/test/msw";
import { serveApp } from "~/test/server-build";
import * as indexModule from "./_index";

// The home page against the fixture API through msw: its three reads, each
// region failing alone while the page stays 200, and the document.

const fixtures = serveFixtureApi();
const get = serveApp([
  {
    id: "routes/_index",
    index: true,
    module: indexModule,
    hasLoader: true,
  },
]);

afterEach(() => {
  vi.restoreAllMocks();
});

function quietErrors() {
  return vi.spyOn(console, "error").mockImplementation(() => undefined);
}

function mainOf(html: string): string {
  return html.slice(
    html.indexOf('<main id="content"'),
    html.indexOf("</main>")
  );
}

async function load() {
  return indexModule.loader(routeArgs(new Request("https://app.test/")));
}

describe("home loader", () => {
  it("reads the piece and person counts and the terms, in parallel", async () => {
    const seen: string[] = [];
    fixtures.server.events.on("request:start", ({ request }) => {
      const url = new URL(request.url);
      seen.push(`${url.pathname}${url.search}`);
    });
    const answer = await load();
    expect(seen.sort()).toEqual([
      "/v1/persons?limit=1",
      "/v1/pieces?limit=1",
      "/v1/terms",
    ]);
    expect(answer.totals).toEqual({
      pieces: expect.any(Number),
      people: expect.any(Number),
    });
    expect(answer.kinds?.length).toBeGreaterThan(0);
  });

  it("offers at most three moods, then three topics, most-used first", async () => {
    const answer = await load();
    const labels = (answer.topTerms ?? []).map(({ label }) => label);
    // Three moods, then three topics, each group by use (the fixture's
    // piece counts, read from the API), ties by name.
    expect(labels).toEqual([
      "Mood: Joyful",
      "Mood: Relaxed",
      "Mood: Sentimental",
      "Topic: War",
      "Topic: Wandering",
      "Topic: Battles",
    ]);
    const terms = (await (await fetch(`${API_BASE_URL}/v1/terms`)).json()) as {
      readonly data: readonly {
        readonly facet: string;
        readonly display_name: string;
        readonly piece_count: number;
      }[];
    };
    const count = (label: string) =>
      terms.data.find(
        term => term.display_name === label.slice(label.indexOf(": ") + 2)
      )?.piece_count ?? -1;
    for (const group of [labels.slice(0, 3), labels.slice(3)]) {
      expect(group.map(count)).toEqual(
        [...group.map(count)].sort((a, b) => b - a)
      );
    }
  });

  it.each([
    ["listPieces", { totals: null, kinds: null }],
    ["listPersons", { totals: null }],
    ["listTerms", { topTerms: null }],
  ] as const)(
    "turns a %s failure into its region, nothing thrown",
    async (operationId, expected) => {
      quietErrors();
      fixtures.fail({ operationId, status: 500, code: "internal" });
      expect(await load()).toMatchObject(expected);
    }
  );

  it("survives a network failure of the terms", async () => {
    quietErrors();
    fixtures.server.use(
      http.get(`${API_BASE_URL}/v1/terms`, () => HttpResponse.error())
    );
    expect(await load()).toMatchObject({ topTerms: null });
  });
});

describe("home document", () => {
  it("shows the counts, the Browse pieces action and internal chips", async () => {
    const response = await get("/");
    expect(response.status).toBe(200);
    const main = mainOf(await response.text());
    expect(main).toContain("249 pieces and 14 people and groups so far");
    expect(main).toContain('href="/pieces"');
    expect(main).toContain('href="/categories"');
    expect(main).toContain('href="/collections"');
    expect(main).toContain('href="/events"');
    expect(main).toContain('href="/pieces?kind=song"');
    expect(main).not.toContain("miraheze.org");
    expect(main).not.toContain("Browse on the original wiki");
  });

  it("is still 200 with a region error when the terms fail", async () => {
    quietErrors();
    fixtures.fail({ operationId: "listTerms", status: 500, code: "internal" });
    const response = await get("/");
    expect(response.status).toBe(200);
    const main = mainOf(await response.text());
    expect(main).toContain("We couldn’t load the categories");
    expect(main).toContain("pieces and");
  });

  it("is still 200 without the counts line when the pieces fail", async () => {
    quietErrors();
    fixtures.fail({ operationId: "listPieces", status: 500, code: "internal" });
    const response = await get("/");
    expect(response.status).toBe(200);
    const main = mainOf(await response.text());
    expect(main).not.toContain("so far");
    expect(main).toContain("We couldn’t load the catalogue’s counts");
  });
});
