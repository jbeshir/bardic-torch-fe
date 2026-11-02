import { describe, expect, it } from "vitest";
import { serveApp } from "~/test/server-build";
import { routeData } from "~/test/single-fetch";
import * as helpModule from "./help.$slug";

const get = serveApp([
  {
    id: "routes/help.$slug",
    path: "help/:slug",
    module: helpModule,
    hasLoader: true,
  },
]);

function mainOf(html: string): string {
  return html.slice(
    html.indexOf('<main id="content"'),
    html.indexOf("</main>")
  );
}

describe("/help/:slug", () => {
  it("serves a help page inside the shell, titled and described from its front matter", async () => {
    const response = await get("/help/contributing");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("<title>Contributing guide · Bardic Torch</title>");
    expect(html).toContain(
      '<meta name="description" content="How to add bards, pieces, links and categories to Bardic Torch'
    );
    expect(html).toContain(
      '<meta property="og:description" content="Anyone can help keep the torch lit.'
    );
    const main = mainOf(html);
    expect(main).toMatch(/<h1[^>]*>Contributing guide<\/h1>/);
    expect(main).toContain('aria-label="Breadcrumb"');
    expect(main).toContain("Adapted from the original");
    // The sidebar marks the page as the current one.
    expect(html).toMatch(
      /<a[^>]*aria-current="page"[^>]*href="\/help\/contributing"|<a[^>]*href="\/help\/contributing"[^>]*aria-current="page"/
    );
  });

  it("server-renders the infobox before the prose, and the contents open", async () => {
    const main = mainOf(await (await get("/help/contributing")).text());
    const infobox = main.indexOf('<aside aria-labelledby="');
    const prose = main.indexOf('<div class="prose-bt">');
    expect(infobox).toBeGreaterThan(-1);
    expect(infobox).toBeLessThan(prose);
    expect(main).toMatch(/<details open=""/);
  });

  it("is the 404 page inside the shell for an unknown help page", async () => {
    const response = await get("/help/lyrics");
    expect(response.status).toBe(404);
    const html = await response.text();
    expect(mainOf(html)).toContain("We couldn’t find that page");
    expect(html).toContain("<title>Page not found · Bardic Torch</title>");
    expect(html).toContain('<meta name="robots" content="noindex"/>');
    expect(html).toContain("<footer");
  });

  it("answers data requests with the slug, or 404", async () => {
    const found = await get(
      "/help/faq-for-bards.data?_routes=routes%2Fhelp.%24slug"
    );
    expect(found.status).toBe(200);
    expect(await routeData(found, "routes/help.$slug")).toEqual({
      slug: "faq-for-bards",
    });
    const missing = await get(
      "/help/nowhere.data?_routes=routes%2Fhelp.%24slug"
    );
    expect(missing.status).toBe(404);
  });
});
