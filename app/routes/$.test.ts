import { describe, expect, it } from "vitest";
import { serveApp } from "~/test/server-build";
import * as indexModule from "./_index";
import * as notFoundModule from "./$";

const get = serveApp([
  { id: "routes/_index", index: true, module: indexModule, hasLoader: false },
  { id: "routes/$", path: "*", module: notFoundModule, hasLoader: true },
]);

describe("$ (any other address)", () => {
  it("is a 404 page inside the shell", async () => {
    const response = await get("/wiki/Ballad_of_Bell");
    expect(response.status).toBe(404);
    const html = await response.text();
    const main = html.slice(
      html.indexOf('<main id="content"'),
      html.indexOf("</main>")
    );
    expect(main).toContain("We couldn’t find that page");
    expect(html).toContain('<nav id="site-nav" aria-label="Site"');
    expect(html).toContain("<footer");
    expect(html).toContain("<title>Page not found · Bardic Torch</title>");
    expect(html).toContain('<meta name="robots" content="noindex"/>');
  });

  it("searches the catalogue and the original wiki for the last part of the address", async () => {
    const html = await (await get("/wiki/Ballad_of_Bell")).text();
    expect(html).toContain('href="/search?q=Ballad+of+Bell"');
    expect(html).toContain("Search the catalogue for ‘Ballad of Bell’");
    expect(html).toContain("index.php?search=Ballad+of+Bell");
    expect(html).toContain(
      "Pages from the old wiki don’t redirect here yet, so try searching for it."
    );
  });

  it("answers data requests with 404 too", async () => {
    const response = await get("/nowhere.data");
    expect(response.status).toBe(404);
  });
});
