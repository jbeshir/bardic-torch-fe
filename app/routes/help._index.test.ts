import { describe, expect, it } from "vitest";
import { serveApp } from "~/test/server-build";
import * as helpIndexModule from "./help._index";

const get = serveApp([
  {
    id: "routes/help._index",
    path: "help",
    module: helpIndexModule,
    hasLoader: false,
  },
]);

function mainOf(html: string): string {
  return html.slice(
    html.indexOf('<main id="content"'),
    html.indexOf("</main>")
  );
}

describe("/help", () => {
  it("is the help index inside the shell, titled and described", async () => {
    const response = await get("/help");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("<title>Help · Bardic Torch</title>");
    expect(html).toContain(
      '<meta name="description" content="Guides to contributing to Bardic Torch'
    );
    expect(mainOf(html)).toMatch(/<h1[^>]*>Help<\/h1>/);
    expect(html).toContain("<footer");
  });

  it("has a card linking to each help page, in the navigation's order", async () => {
    const main = mainOf(await (await get("/help")).text());
    const cards = [...main.matchAll(/<h3[^>]*><a[^>]*href="([^"]+)"/g)].map(
      ([, href]) => href
    );
    expect(cards).toEqual([
      "/help/contributing",
      "/help/faq-for-bards",
      "/help/bard-preference-checklist",
      "/help/conservation-status",
      "/help/licence",
    ]);
  });
});
