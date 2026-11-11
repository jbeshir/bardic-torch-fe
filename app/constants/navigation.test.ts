import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CONTACT_FORM_URL,
  HELP_PAGES,
  helpHref,
  isWikiUrl,
  NAV_GROUPS,
  WIKI_HOME_URL,
  wikiPageUrl,
  wikiSearchUrl,
} from "./navigation";

// The titles of the original wiki's pages and categories, snapshotted from the
// wiki dump by scripts/wiki-categories.mjs.
const SNAPSHOT = JSON.parse(
  readFileSync("test/fixtures/wiki-categories.json", "utf8")
) as { categories: string[]; pages: string[] };

describe("wiki URLs", () => {
  it.each([
    ["Category:Source_Category", "Category:Source_Category"],
    ["Main Page", "Main_Page"],
    ["Category:Traditional & Folk", "Category:Traditional_%26_Folk"],
  ])("writes the title %j as MediaWiki does", (title, path) => {
    expect(wikiPageUrl(title)).toBe(
      `https://bardictorch.miraheze.org/wiki/${path}`
    );
  });

  it("searches the wiki with a GET to index.php?search=", () => {
    expect(wikiSearchUrl("ballad of the reeve & bell")).toBe(
      "https://bardictorch.miraheze.org/w/index.php?search=ballad+of+the+reeve+%26+bell"
    );
  });

  it.each([
    ["https://bardictorch.miraheze.org", true],
    [wikiPageUrl("Collections"), true],
    ["https://bardictorch.miraheze.org.example.com/wiki", false],
    [CONTACT_FORM_URL, false],
    ["/help/licence", false],
  ])("isWikiUrl(%j) is %s", (url, expected) => {
    expect(isWikiUrl(url)).toBe(expected);
  });

  it("links the wiki's front page, which exists on the wiki", () => {
    const title = decodeURIComponent(WIKI_HOME_URL.split("/wiki/")[1] ?? "");
    expect(SNAPSHOT.pages).toContain(title.replaceAll("_", " "));
  });
});

describe("navigation", () => {
  it("links only internal paths, and the help pages in HELP_PAGES order", () => {
    for (const { href } of NAV_GROUPS.flatMap(group => group.items)) {
      expect(href.startsWith("/"), href).toBe(true);
    }
    expect(NAV_GROUPS[2]?.items.map(({ href }) => href)).toEqual(
      HELP_PAGES.map(({ slug }) => helpHref(slug))
    );
  });
});
