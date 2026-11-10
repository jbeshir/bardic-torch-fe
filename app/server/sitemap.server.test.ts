import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, loadContext } from "~/test/context";
import { contractResponse } from "~/test/contract";
import { serveFixtureApi } from "~/test/msw";
import { sitemap } from "./sitemap.server";

// The sitemap against the fixture API through msw.

const fixtures = serveFixtureApi();
const ORIGIN = "https://bardictorch.example";

afterEach(() => {
  vi.restoreAllMocks();
});

/** The `<loc>` addresses of a sitemap. */
function locations(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(match => match[1] ?? "");
}

describe("the sitemap", () => {
  it("is one urlset of the pages and the public catalogue, leaving out restricted pieces and stub persons", async () => {
    const response = await sitemap(loadContext(), ORIGIN);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/xml; charset=utf-8"
    );
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
    const xml = await response.text();
    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    );
    const paths = locations(xml);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of [
      "/",
      "/help/contributing",
      "/events",
      "/pieces/the-copper-kettle",
      "/categories/warlike",
      "/collections/12",
      "/events/muster-field",
    ]) {
      expect(paths).toContain(`${ORIGIN}${path}`);
    }

    const get = async <T>(path: string) =>
      (await fetch(`${API_BASE_URL}${path}`).then(reply => reply.json())) as {
        total: number;
        data: T[];
      };
    const restricted = await get<{ slug: string }>(
      "/v1/pieces?conservation_status=restricted&limit=100"
    );
    const stubs = (
      await get<{ slug: string; is_stub: boolean }>("/v1/persons?limit=100")
    ).data.filter(person => person.is_stub);
    expect(restricted.total).toBeGreaterThan(0);
    expect(stubs.length).toBeGreaterThan(0);
    for (const { slug } of restricted.data) {
      expect(paths).not.toContain(`${ORIGIN}/pieces/${slug}`);
    }
    for (const { slug } of stubs) {
      expect(paths).not.toContain(`${ORIGIN}/bards/${slug}`);
    }
  });

  it.each([
    [
      "pieces",
      "/v1/pieces",
      () =>
        contractResponse("listPieces", 500, { code: "internal", message: "x" }),
      "60",
    ],
    ["persons", "/v1/persons", () => HttpResponse.error(), "30"],
    [
      "terms",
      "/v1/terms",
      () => new HttpResponse("down", { status: 503 }),
      "60",
    ],
  ])(
    "is a 503 with Retry-After and no urlset when the %s read fails",
    async (_list, path, failure, retryAfter) => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      fixtures.server.use(http.get(`${API_BASE_URL}${path}`, failure));
      const response = await sitemap(loadContext(), ORIGIN);
      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBe(retryAfter);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(await response.text()).not.toContain("<urlset");
    }
  );
});
