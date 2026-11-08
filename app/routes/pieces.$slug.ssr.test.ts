import { delay, http, HttpResponse } from "msw";
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
import { singleFetchResults } from "~/test/single-fetch";
import * as layoutModule from "./pieces.$slug";
import * as readModule from "./pieces.$slug._index";

// /pieces/:slug against the fixture API through msw: the layout's loader on
// its own (the slug check before any call, every getPiece failure), and the
// documents and `.data` answers the real server entry and root make of it.

const fixtures = serveFixtureApi();
const LAYOUT = "routes/pieces.$slug";
const READ = "routes/pieces.$slug._index";
const get = serveApp([
  {
    id: LAYOUT,
    path: "pieces/:slug",
    module: layoutModule,
    hasLoader: true,
    hasErrorBoundary: true,
  },
  {
    id: READ,
    parentId: LAYOUT,
    index: true,
    module: readModule,
    hasLoader: false,
  },
]);

const PIECE = `${API_BASE_URL}/v1/pieces/:slug`;

afterEach(() => {
  vi.restoreAllMocks();
});

function quietErrors() {
  return vi.spyOn(console, "error").mockImplementation(() => undefined);
}

const signedIn = () =>
  sessionCookie(sessionTokens({ accessToken: "fixture:contributor" }));

/** The getPiece requests the fixture API sees. */
function upstreamRequests() {
  const seen: string[] = [];
  fixtures.server.events.on("request:start", ({ request }) => {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/v1/pieces/")) seen.push(pathname);
  });
  return seen;
}

/** Runs the loader for `slug`; a thrown answer is returned. */
async function load(slug: string): Promise<unknown> {
  try {
    return await layoutModule.loader(
      routeArgs(
        new Request(`https://app.test/pieces/${encodeURIComponent(slug)}`),
        { pattern: "/pieces/:slug", params: { slug } }
      )
    );
  } catch (thrown) {
    return thrown;
  }
}

/** Make the fixture API answer like a proxy whose backend is down. */
async function outage(slug: string) {
  const response = await fetch(`${API_BASE_URL}/__fixtures/outage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      operationId: "getPiece",
      match: { slug },
      mode: "503",
    }),
  });
  expect(response.ok).toBe(true);
}

function mainOf(html: string): string {
  return html.slice(
    html.indexOf('<main id="content"'),
    html.indexOf("</main>")
  );
}

describe("/pieces/:slug loader", () => {
  it("loads the piece", async () => {
    expect(await load("the-copper-kettle")).toMatchObject({
      piece: { slug: "the-copper-kettle", title: "The Copper Kettle" },
    });
  });

  it("parses the Markdown fields into trees, raw HTML dropped", async () => {
    const view = (await load("the-copper-kettle")) as {
      markdown: Record<string, unknown>;
    };
    expect(view.markdown["notes"]).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "text", value: "Sung at " },
          { type: "emphasis", children: [{ type: "text", value: "many" }] },
          { type: "text", value: " feasts; see " },
          {
            type: "link",
            href: "https://collections.example/1",
            children: [{ type: "text", value: "the tune index" }],
          },
          { type: "text", value: "." },
        ],
      },
      {
        type: "list",
        ordered: false,
        start: null,
        items: [
          [
            {
              type: "paragraph",
              children: [
                { type: "text", value: "The first verse is " },
                {
                  type: "strong",
                  children: [{ type: "text", value: "short" }],
                },
              ],
            },
          ],
          [
            {
              type: "paragraph",
              children: [{ type: "text", value: "The chorus repeats" }],
            },
          ],
        ],
      },
      // The span's tags are dropped; its words stay, as text.
      {
        type: "paragraph",
        children: [{ type: "text", value: "raw html must not render" }],
      },
    ]);
    expect(view.markdown["versions"]).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "text", value: "This version has a slower chorus." },
        ],
      },
    ]);
    expect(view.markdown["historicalSource"]).toBeNull();
  });

  it.each([
    ["upper case", "Bad"],
    ["a doubled hyphen", "a--b"],
    ["too long", "a".repeat(192)],
    ["a slash", "a/b"],
    ["empty", ""],
  ])(
    "answers a slug that can't be one (%s) 404 without asking the API",
    async (_why, slug) => {
      const seen = upstreamRequests();
      expect(await load(slug)).toMatchObject({
        data: { kind: "not_found" },
        init: { status: 404 },
      });
      expect(seen).toHaveLength(0);
    }
  );

  it("answers an unknown piece 404", async () => {
    quietErrors();
    expect(await load("no-such-piece")).toMatchObject({
      data: { kind: "not_found" },
      init: { status: 404 },
    });
  });

  it("answers the API's 400 (a contract mismatch) 404, and logs it", async () => {
    const errors = quietErrors();
    fixtures.server.use(
      http.get(PIECE, () =>
        contractResponse("getPiece", 400, {
          code: "invalid_request",
          message: "invalid slug",
        })
      )
    );
    expect(await load("the-copper-kettle")).toMatchObject({
      data: { kind: "not_found" },
      init: { status: 404 },
    });
    expect(errors).toHaveBeenCalledWith(
      "getPiece answered 400:",
      "invalid_request: invalid slug"
    );
  });

  it("throws server (500) for a 500", async () => {
    quietErrors();
    fixtures.fail({ operationId: "getPiece", status: 500, code: "internal" });
    expect(await load("the-copper-kettle")).toMatchObject({
      data: { kind: "server" },
      init: { status: 500 },
    });
  });

  it("throws resting (503, Retry-After 60) for a proxy's 503", async () => {
    quietErrors();
    await outage("the-copper-kettle");
    const answer = (await load("the-copper-kettle")) as {
      data: unknown;
      init: { status: number; headers: Headers };
    };
    expect(answer.data).toEqual({ kind: "resting", retryAfter: 60 });
    expect(answer.init.status).toBe(503);
    expect(answer.init.headers.get("Retry-After")).toBe("60");
  });

  it("throws resting (503, Retry-After 30) for a network failure", async () => {
    quietErrors();
    fixtures.server.use(http.get(PIECE, () => HttpResponse.error()));
    const answer = (await load("the-copper-kettle")) as {
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
      http.get(PIECE, async () => {
        await delay("infinite");
        return HttpResponse.error();
      })
    );
    expect(await load("the-copper-kettle")).toMatchObject({
      data: { kind: "resting" },
      init: { status: 503 },
    });
  });

  it("throws bad_gateway (502) for a malformed body", async () => {
    quietErrors();
    fixtures.server.use(
      http.get(PIECE, () =>
        offContractResponse("getPiece", 200, { slug: "x" }, "no fields")
      )
    );
    expect(await load("the-copper-kettle")).toMatchObject({
      data: { kind: "bad_gateway" },
      init: { status: 502 },
    });
  });

  it("throws bad_gateway (502) for a named credit without a person", async () => {
    quietErrors();
    const answer = await fetch(`${API_BASE_URL}/v1/pieces/the-copper-kettle`);
    const piece = (await answer.json()) as {
      credits: { attribution: string; person: unknown }[];
    };
    fixtures.server.use(
      // The spec's schema allows it; its words (and the API docs) don't.
      http.get(PIECE, () =>
        contractResponse("getPiece", 200, {
          ...piece,
          credits: [{ ...piece.credits[0], attribution: "named" }],
        })
      )
    );
    expect(await load("the-copper-kettle")).toMatchObject({
      data: { kind: "bad_gateway" },
      init: { status: 502 },
    });
  });

  it("loads the piece again for a new address or Try again, not a new history page", () => {
    const at = (path: string) => new URL(`https://app.test${path}`);
    const revalidates = (from: string, to: string) =>
      layoutModule.shouldRevalidate({
        currentUrl: at(from),
        nextUrl: at(to),
        currentParams: {},
        nextParams: {},
        defaultShouldRevalidate: true,
      });
    expect(revalidates("/pieces/a/history", "/pieces/a/history?page=2")).toBe(
      false
    );
    expect(revalidates("/pieces/a", "/pieces/a")).toBe(true);
    expect(revalidates("/pieces/a", "/pieces/b")).toBe(true);
    expect(revalidates("/pieces/a", "/pieces/a/history")).toBe(true);
  });
});

describe("/pieces/:slug document", () => {
  it("is the piece, titled, described, canonical and described for search engines", async () => {
    const response = await get("/pieces/the-copper-kettle");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache");
    const html = await response.text();
    expect(html).toContain("<title>The Copper Kettle · Bardic Torch</title>");
    expect(html).toMatch(
      /<link rel="canonical" href="https:\/\/app\.test\/pieces\/the-copper-kettle"\/?>/
    );
    expect(html).not.toContain('name="robots"');
    const ld = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(
      html
    )?.[1];
    expect(JSON.parse(ld ?? "null")).toEqual({
      "@context": "https://schema.org",
      "@type": "MusicComposition",
      name: "The Copper Kettle",
      alternateName: ["The Kettle Song", "Old Copper", "A Tavern Favourite"],
      genre: ["Song", "Dance music"],
      // The tune and the arrangement are the music's; the words are
      // traditional, so there is no author.
      composer: [
        {
          "@type": "Person",
          name: "Wren of the Vale",
          url: "https://app.test/bards/wren-of-the-vale",
        },
        {
          "@type": "Person",
          name: "Aldith of Ashdown",
          url: "https://app.test/bards/aldith-of-ashdown",
        },
      ],
      url: "https://app.test/pieces/the-copper-kettle",
    });
    const main = mainOf(html);
    expect(main).toMatch(/<h1[^>]*>The Copper Kettle<\/h1>/);
    expect(main).toContain("Song · Dance music · 1650–1750");
    expect(main).toContain('href="/pieces/the-copper-kettle/history"');
    expect(main).toContain("About this piece");
    // The notes, rendered from the server's tree: a reader's link, never
    // their raw HTML.
    expect(main).toMatch(/<h2 id="notes">Notes<\/h2>/);
    expect(main).toContain("<em>many</em>");
    expect(main).toMatch(
      /<a href="https:\/\/collections\.example\/1" rel="nofollow ugc noopener"/
    );
    expect(main).not.toContain('class="raw"');
    expect(main).toContain("<p>raw html must not render</p>");
    expect(main).toMatch(/<h2 id="versions">Versions<\/h2>/);
    // Six sections, so the contents list them, the licensing card among
    // them (the infobox's Licensing row links there too).
    expect(main).toContain('href="#licensing"');
    expect(main).toMatch(/<h2 id="licensing"[^>]*>Licensing<\/h2>/);
    expect(main).toContain("Known");
    expect(main).toContain("Public domain");
    expect(main).toMatch(/<h2 id="related-pieces">Related pieces<\/h2>/);
    expect(main).toMatch(/>Variants<\/h3>/);
    expect(main).toMatch(/>Contrafacta<\/h3>/);
    expect(main).toContain('href="/pieces/kettle-and-tongs"');
  });

  it("lists where the piece is, by role, with a link under each of its roles", async () => {
    const main = mainOf(await (await get("/pieces/the-copper-kettle")).text());
    expect(main).toMatch(/<h2 id="where-to-find-it">Where to find it<\/h2>/);
    expect(
      main.match(/href="https:\/\/collections\.example\/12\/kettle"/g)
    ).toHaveLength(3);
    expect(main).toContain("This link may be broken");
    expect(main).toContain(
      'href="https://web-archive.example/2022/old-archive/kettle.html"'
    );
    expect(main).toMatch(/<h2 id="performances">Performances<\/h2>/);
    expect(main).not.toContain("HIDDEN-");
  });

  it("keeps a restricted piece's links inside one closed disclosure, with no archived copies", async () => {
    const main = mainOf(await (await get("/pieces/the-dragons-hoard")).text());
    expect(main).toMatch(
      /<h2 id="where-it-has-been-recorded">Where it has been recorded<\/h2>/
    );
    expect(main).not.toContain('id="where-to-find-it"');
    expect(main).not.toContain('id="performances"');
    // The infobox's status history is the page's other disclosure.
    const open = main.indexOf(
      "<details",
      main.indexOf('id="where-it-has-been-recorded"')
    );
    const close = main.indexOf("</details>", open);
    expect(main.slice(open, close)).toContain(
      "Show links (the creator asks that this isn’t shared further)"
    );
    expect(main.indexOf("<details", open + 1)).toBe(-1);
    // Every mention of the restricted host is inside the disclosure.
    const host = /private-recordings\.example/g;
    for (const match of main.matchAll(host)) {
      expect(match.index).toBeGreaterThan(open);
      expect(match.index).toBeLessThan(close);
    }
    expect(main).not.toContain("web-archive.example");
    expect(main).not.toMatch(/<details[^>]*\sopen/);
  });

  it("keeps a restricted piece out of search results, with no description for them", async () => {
    const html = await (await get("/pieces/the-dragons-hoard")).text();
    expect(html).toContain('<meta name="robots" content="noindex, nofollow"/>');
    expect(html).not.toContain("application/ld+json");
    expect(mainOf(html)).toContain(
      "The creator has asked that this work isn’t recorded or shared."
    );
  });

  it("drops a credit to a person who asked not to have a page, leaving the rest", async () => {
    const main = mainOf(
      await (await get("/pieces/the-ashdown-wassail")).text()
    );
    expect(main).toContain("Tune");
    expect(main).toContain("Traditional");
    expect(main).not.toContain("hollis");
    expect(main).not.toContain("Hollis");
    expect(main.toLowerCase()).not.toContain("unknown author");
  });

  it("is our own 404 for a slug that can't be one, without asking the API", async () => {
    const seen = upstreamRequests();
    const response = await get("/pieces/Bad");
    expect(response.status).toBe(404);
    const html = await response.text();
    expect(html).toContain(
      "<title>We couldn’t find that piece · Bardic Torch</title>"
    );
    expect(html).toContain('<meta name="robots" content="noindex"/>');
    expect(mainOf(html)).toMatch(/<h1[^>]*>We couldn’t find that piece<\/h1>/);
    expect(seen).toHaveLength(0);
  });

  it("is the 404 page inside the shell for an unknown piece", async () => {
    quietErrors();
    const response = await get("/pieces/no-such-piece");
    expect(response.status).toBe(404);
    const html = await response.text();
    expect(html).toContain('aria-label="Site"');
    expect(mainOf(html)).toContain("Go to the home page");
  });

  it("is the server error (500) inside the shell", async () => {
    quietErrors();
    fixtures.fail({ operationId: "getPiece", status: 500, code: "internal" });
    const response = await get("/pieces/the-copper-kettle");
    expect(response.status).toBe(500);
    const html = await response.text();
    expect(html).toContain(
      "<title>We couldn’t load this piece · Bardic Torch</title>"
    );
    expect(mainOf(html)).toMatch(/<h1[^>]*>We couldn’t load this piece<\/h1>/);
  });

  it("is a 502 for an answer it can't read", async () => {
    quietErrors();
    fixtures.server.use(
      http.get(PIECE, () => new HttpResponse("<html>", { status: 200 }))
    );
    const response = await get("/pieces/the-copper-kettle");
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
      await outage("midwinter-carol");
      const response = await get(
        "/pieces/midwinter-carol",
        who ? await signedIn() : undefined
      );
      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBe("60");
      expect(response.headers.get("Cache-Control")).toBe(cacheControl);
      const html = await response.text();
      expect(html).toContain(
        "<title>Bardic Torch is resting · Bardic Torch</title>"
      );
      expect(html).toContain('aria-label="Site"');
    }
  );

  it("sends the API no Authorization or Cookie, signed in", async () => {
    const seen: Headers[] = [];
    fixtures.server.events.on("request:start", ({ request }) => {
      if (new URL(request.url).pathname.startsWith("/v1/pieces/")) {
        seen.push(request.headers);
      }
    });
    const response = await get("/pieces/the-copper-kettle", await signedIn());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(seen).toHaveLength(1);
    expect(seen[0]?.get("Authorization")).toBeNull();
    expect(seen[0]?.get("Cookie")).toBeNull();
  });
});

describe("/pieces/:slug data requests", () => {
  const data = (slug: string, routes = `root,${LAYOUT},${READ}`) =>
    `/pieces/${slug}.data?${new URLSearchParams([["_routes", routes]])}`;

  it("answers the piece", async () => {
    const response = await get(data("the-copper-kettle", `${LAYOUT},${READ}`));
    expect(response.status).toBe(200);
    const results = await singleFetchResults(response);
    expect(results[LAYOUT]).toMatchObject({
      data: { piece: { slug: "the-copper-kettle" } },
    });
  });

  it.each([
    ["signed out", undefined, "private, no-cache"],
    ["signed in", "in", "no-store"],
  ])(
    "is the resting failure with Retry-After, %s",
    async (_who, who, cacheControl) => {
      quietErrors();
      await outage("yule-rising");
      const response = await get(
        data("yule-rising"),
        who ? await signedIn() : undefined
      );
      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBe("60");
      expect(response.headers.get("Cache-Control")).toBe(cacheControl);
      const results = await singleFetchResults(response);
      expect(results[LAYOUT]).toMatchObject({
        error: { status: 503, data: { kind: "resting" } },
      });
    }
  );
});
