import { expect } from "@playwright/test";
import { failNext } from "../support/fixture-api";
import { test } from "../support/test";

/**
 * Indexing in the production build (plan C10): robots.txt, the sitemaps and
 * a piece's head as the server sent it. The preview, e2e and development
 * builds are the opposite (e2e/stub/seo.spec.ts).
 */

test.describe.configure({ mode: "parallel" });

test("robots.txt allows crawling, disallows only what isn't a page, and names the sitemap", async ({
  request,
  baseURL,
}) => {
  const response = await request.get("/robots.txt");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("text/plain; charset=utf-8");
  expect(response.headers()["cache-control"]).toBe("public, max-age=3600");
  expect(response.headers()["x-robots-tag"]).toBeUndefined();
  expect(await response.text()).toBe(
    [
      "User-agent: *",
      "Disallow: /auth/",
      "Disallow: /api/",
      "Disallow: /resources/",
      "Disallow: /settings",
      "",
      `Sitemap: ${baseURL}/sitemap.xml`,
      "",
    ].join("\n")
  );
});

test("no response of the production build says noindex in a header", async ({
  request,
}) => {
  for (const path of ["/", "/pieces", "/sitemap.xml", "/robots.txt"]) {
    const response = await request.get(path);
    expect(response.headers()["x-robots-tag"], path).toBeUndefined();
  }
});

test("a piece's raw HTML has its canonical address, social card and JSON-LD", async ({
  request,
  baseURL,
}) => {
  const html = await (await request.get("/pieces/the-copper-kettle")).text();
  expect(html).toContain(
    `<link rel="canonical" href="${baseURL}/pieces/the-copper-kettle"`
  );
  expect(html).toContain(
    '<meta property="og:title" content="The Copper Kettle"'
  );
  expect(html).toContain(
    `<meta property="og:url" content="${baseURL}/pieces/the-copper-kettle"`
  );
  expect(html).toContain('<meta name="twitter:card" content="summary"');
  expect(html).not.toContain('<meta name="robots"');
  const json =
    /<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/s.exec(
      html
    )?.[1];
  expect(json).toBeTruthy();
  const data = JSON.parse(json ?? "{}") as Record<string, unknown>;
  expect(data["@context"]).toBe("https://schema.org");
  expect(["MusicComposition", "CreativeWork"]).toContain(data["@type"]);
  expect(data["name"]).toBe("The Copper Kettle");
});

test("sitemap.xml indexes three sitemaps on this origin", async ({
  request,
  baseURL,
}) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe(
    "application/xml; charset=utf-8"
  );
  expect(response.headers()["cache-control"]).toBe("public, max-age=3600");
  const xml = await response.text();
  expect(xml).toContain("<sitemapindex");
  for (const name of ["pages", "pieces", "bards"]) {
    expect(xml).toContain(`<loc>${baseURL}/sitemap/${name}.xml</loc>`);
  }
});

test("the pieces sitemap lists every unrestricted fixture piece, once", async ({
  request,
  baseURL,
}) => {
  const response = await request.get("/sitemap/pieces.xml");
  expect(response.status()).toBe(200);
  const xml = await response.text();
  const locations = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(
    match => match[1]
  );
  expect(locations.length).toBeGreaterThan(200);
  expect(new Set(locations).size).toBe(locations.length);
  expect(locations).toContain(`${baseURL}/pieces/the-copper-kettle`);
  // A restricted piece asks not to be shared.
  expect(locations).not.toContain(`${baseURL}/pieces/the-dragons-hoard`);
});

test("the bards sitemap leaves out a person without a page", async ({
  request,
  baseURL,
}) => {
  const xml = await (await request.get("/sitemap/bards.xml")).text();
  expect(xml).toContain(`<loc>${baseURL}/bards/the-greywater-minstrels</loc>`);
  expect(xml).not.toContain("/bards/hollis-fenn<");
});

test("the pages sitemap lists the home page, help and the directories", async ({
  request,
  baseURL,
}) => {
  const xml = await (await request.get("/sitemap/pages.xml")).text();
  for (const path of ["/", "/help/licence", "/pieces", "/events"]) {
    expect(xml).toContain(`<loc>${baseURL}${path}</loc>`);
  }
  expect(xml).not.toContain("/search");
});

test("an unknown sitemap is a 404", async ({ request }) => {
  expect((await request.get("/sitemap/nope.xml")).status()).toBe(404);
});

test("a sitemap is a 503 with Retry-After, and no partial list, when the API fails", async ({
  request,
}) => {
  // The only requests with these paging parameters are the sitemap's; the
  // other sitemap tests read the same pages, so the failure is for one.
  await failNext(request, {
    operationId: "listPieces",
    status: 500,
    code: "internal",
    times: 1,
    match: { limit: "100", offset: "200" },
  });
  const response = await request.get("/sitemap/pieces.xml");
  expect(response.status()).toBe(503);
  expect(response.headers()["retry-after"]).toBe("60");
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(await response.text()).not.toContain("<loc>");
  // The failure was for one read: the next attempt works.
  expect((await request.get("/sitemap/pieces.xml")).status()).toBe(200);
});
