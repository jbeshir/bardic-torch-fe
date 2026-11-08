import { afterEach, describe, expect, it, vi } from "vitest";
import { robotsTxt } from "./indexing.server";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("robotsTxt", () => {
  it("lets production be crawled, but not the routes that aren't pages", () => {
    expect(robotsTxt("https://bardictorch.example")).toBe(
      [
        "User-agent: *",
        "Disallow: /auth/",
        "Disallow: /api/",
        "Disallow: /resources/",
        "Disallow: /settings",
        "",
        "Sitemap: https://bardictorch.example/sitemap.xml",
        "",
      ].join("\n")
    );
  });

  it("doesn't disallow the pages that say noindex themselves, so crawlers can read it", () => {
    const rules = robotsTxt("https://bardictorch.example");
    for (const path of ["/search", "/revisions", "/history", "/pieces"]) {
      expect(rules).not.toContain(`Disallow: ${path}`);
    }
  });

  it.each(["preview", "e2e", "development"])(
    "disallows everything in a %s build, with no sitemap",
    () => {
      vi.stubGlobal("__INDEXABLE__", false);
      expect(robotsTxt("https://preview.example")).toBe(
        "User-agent: *\nDisallow: /\n"
      );
    }
  );
});
