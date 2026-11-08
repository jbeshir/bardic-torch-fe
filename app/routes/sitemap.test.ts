import { describe, expect, it } from "vitest";
import { routeArgs } from "~/test/context";
import { serveFixtureApi } from "~/test/msw";
import { loader as indexLoader } from "./sitemap[.]xml";
import { loader as typeLoader } from "./sitemap.$type";

// The two sitemap routes pass this request's origin (and the type) to the
// sitemap module, which sitemap.server.test.ts covers in depth.

serveFixtureApi();

describe("/sitemap.xml", () => {
  it("lists the sitemaps on the request's origin", async () => {
    const response = indexLoader(
      routeArgs(new Request("https://app.test/sitemap.xml"))
    );
    expect(await response.text()).toContain(
      "<loc>https://app.test/sitemap/pieces.xml</loc>"
    );
  });
});

describe("/sitemap/:type", () => {
  it("serves the named sitemap on the request's origin", async () => {
    const response = await typeLoader(
      routeArgs(new Request("https://app.test/sitemap/pages.xml"), {
        params: { type: "pages.xml" },
      })
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("<loc>https://app.test/help</loc>");
  });

  it("answers 404 for a name it doesn't have", async () => {
    const response = await typeLoader(
      routeArgs(new Request("https://app.test/sitemap/x.xml"), {
        params: { type: "x.xml" },
      })
    );
    expect(response.status).toBe(404);
  });
});
