import { expect } from "@playwright/test";
import { test } from "../support/test";

/**
 * Indexing outside production (plan C10.1): the e2e build, like preview and
 * development, disallows everything and says noindex on every response.
 * The production rules are e2e/prod/seo.spec.ts.
 */

test("robots.txt disallows everything and names no sitemap", async ({
  request,
}) => {
  const response = await request.get("/robots.txt");
  expect(response.status()).toBe(200);
  expect(await response.text()).toBe("User-agent: *\nDisallow: /\n");
  expect(response.headers()["x-robots-tag"]).toBe("noindex");
});

test("every kind of response says noindex in a header: documents, resource routes, sitemaps, errors", async ({
  request,
}) => {
  for (const path of [
    "/",
    "/pieces",
    "/pieces/the-copper-kettle",
    "/help/licence",
    "/no-such-page",
    "/sitemap.xml",
    "/sitemap/pages.xml",
    "/robots.txt",
    "/resources/theme",
  ]) {
    const response = await request.get(path);
    expect(response.headers()["x-robots-tag"], path).toBe("noindex");
  }
});

test("the header is also on a .data answer and a POST refusal", async ({
  request,
}) => {
  const data = await request.get("/pieces/the-copper-kettle.data");
  expect(data.headers()["x-robots-tag"]).toBe("noindex");
  const post = await request.post("/resources/theme", {
    form: { theme: "dark" },
    maxRedirects: 0,
  });
  expect(post.headers()["x-robots-tag"]).toBe("noindex");
});
