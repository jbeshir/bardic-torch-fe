import { afterEach, describe, expect, it, vi } from "vitest";
import { routeArgs } from "~/test/context";
import { loader } from "./robots[.]txt";

afterEach(() => {
  vi.unstubAllGlobals();
});

function robots(origin = "https://bardictorch.example") {
  return loader(routeArgs(new Request(`${origin}/robots.txt`)));
}

describe("/robots.txt", () => {
  it("is plain text, cacheable for an hour, with this origin's sitemap", async () => {
    const response = robots("https://app.test");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/plain; charset=utf-8"
    );
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
    expect(await response.text()).toContain(
      "Sitemap: https://app.test/sitemap.xml"
    );
  });

  it("disallows everything in a build that isn't production", async () => {
    vi.stubGlobal("__INDEXABLE__", false);
    expect(await robots().text()).toBe("User-agent: *\nDisallow: /\n");
  });
});
