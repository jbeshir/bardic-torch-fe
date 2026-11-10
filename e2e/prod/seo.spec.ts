import { expect } from "@playwright/test";
import { test } from "../support/test";

/**
 * Indexing in the production build (plan C10): robots.txt, the sitemap and
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

test("a piece's raw HTML has its canonical address and social card", async ({
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
});

test("sitemap.xml is one urlset of the pages and unrestricted entries", async ({
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
  expect(xml).toContain("<urlset");
  for (const path of [
    "/help/licence",
    "/pieces/the-copper-kettle",
    "/bards/the-greywater-minstrels",
    "/categories/warlike",
    "/collections/12",
    "/events/muster-field",
  ]) {
    expect(xml).toContain(`<loc>${baseURL}${path}</loc>`);
  }
  // A restricted piece asks not to be shared; a person without a page is
  // left out.
  expect(xml).not.toContain("/pieces/the-dragons-hoard<");
  expect(xml).not.toContain("/bards/hollis-fenn<");
});
