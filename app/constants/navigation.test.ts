import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CONTACT_FORM_URL,
  CONTRIBUTE_HREF,
  HELP_PAGES,
  helpHref,
  isWikiUrl,
  LICENCE_URL,
  NAV_GROUPS,
  WIKI_HOME_URL,
  SEARCH,
  wikiPageUrl,
  wikiSearchUrl,
} from "./navigation";
/**
/**
 * The titles of the original wiki's categories (and the two plain pages the
 * site once linked to), snapshotted from the wiki dump by
 * scripts/wiki-categories.mjs. No navigation entry or help link points at a
 * category any more; the only wiki page the site links to by title from here
 * is its front page (the footer), checked below.
 */
const SNAPSHOT = JSON.parse(
  readFileSync("test/fixtures/wiki-categories.json", "utf8")
) as { categories: string[]; pages: string[] };

const WIKI_PAGE = /^https:\/\/bardictorch\.miraheze\.org\/wiki\/(.+)$/;

/** The wiki title a URL points at, with spaces for underscores. */
function wikiTitle(url: string): string | null {
  const path = WIKI_PAGE.exec(url)?.[1];
  return path ? decodeURIComponent(path).replaceAll("_", " ") : null;
}

function existsOnWiki(title: string): boolean {
  return title.startsWith("Category:")
    ? SNAPSHOT.categories.includes(title.slice("Category:".length))
    : SNAPSHOT.pages.includes(title);
}

const items = NAV_GROUPS.flatMap(group => group.items);

describe("wiki targets", () => {
  it("holds titles only, nothing else from the dump", () => {
    expect(Object.keys(SNAPSHOT).sort()).toEqual([
      "//",
      "categories",
      "pages",
      "snapshot",
    ]);
    expect(SNAPSHOT.categories.length).toBeGreaterThan(100);
    expect(
      [...SNAPSHOT.categories, ...SNAPSHOT.pages].every(
        title => typeof title === "string"
      )
    ).toBe(true);
  });

  it("the wiki's front page exists", () => {
    expect(existsOnWiki(wikiTitle(WIKI_HOME_URL) ?? "")).toBe(true);
  });

  it("a title that isn't on the wiki is caught", () => {
    expect(existsOnWiki("Category:Moodz")).toBe(false);
    expect(existsOnWiki("Collectionz")).toBe(false);
  });
});

describe("wiki URLs", () => {
  it("writes titles the way MediaWiki does: underscores, colon kept, the rest encoded", () => {
    expect(wikiPageUrl("Category:Source_Category")).toBe(
      "https://bardictorch.miraheze.org/wiki/Category:Source_Category"
    );
    expect(wikiPageUrl("Main Page")).toBe(
      "https://bardictorch.miraheze.org/wiki/Main_Page"
    );
    expect(wikiPageUrl("Category:Traditional & Folk")).toBe(
      "https://bardictorch.miraheze.org/wiki/Category:Traditional_%26_Folk"
    );
  });

  it("searches the catalogue with a GET to /search?q=", () => {
    expect(SEARCH).toEqual({ action: "/search", param: "q" });
  });

  it("searches the wiki with a GET to index.php?search=", () => {
    expect(wikiSearchUrl("ballad of the reeve & bell")).toBe(
      "https://bardictorch.miraheze.org/w/index.php?search=ballad+of+the+reeve+%26+bell"
    );
  });
});

describe("isWikiUrl", () => {
  it("is true for the wiki and its pages only", () => {
    expect(isWikiUrl("https://bardictorch.miraheze.org")).toBe(true);
    expect(isWikiUrl(wikiPageUrl("Collections"))).toBe(true);
    expect(isWikiUrl(wikiSearchUrl("bell"))).toBe(true);
    expect(isWikiUrl("https://bardictorch.miraheze.org.example.com/wiki")).toBe(
      false
    );
    expect(isWikiUrl(CONTACT_FORM_URL)).toBe(false);
    expect(isWikiUrl("/help/licence")).toBe(false);
  });
});

describe("navigation", () => {
  it("has Browse, Facets and Help in that order, with no note", () => {
    expect(NAV_GROUPS.map(group => group.heading)).toEqual([
      "Browse",
      "Facets",
      "Help",
    ]);
    expect(NAV_GROUPS.every(group => !("note" in group))).toBe(true);
  });

  it("lists the catalogue entries from the plan, all internal", () => {
    expect(
      NAV_GROUPS.slice(0, 2).flatMap(group =>
        group.items.map(({ label, href }) => [label, href])
      )
    ).toEqual([
      ["Pieces", "/pieces"],
      ["Bards", "/bards"],
      ["Collections", "/collections"],
      ["Events and venues", "/events"],
      ["Categories", "/categories"],
      ["Genre / kind", "/categories?facet=kind"],
      ["Mood", "/categories?facet=mood"],
      ["Topic", "/categories?facet=topic"],
      ["Culture", "/categories?facet=culture"],
      ["Language", "/categories?facet=language"],
      ["Legendaria", "/categories?facet=legendaria"],
      ["Origin", "/categories?facet=origin"],
      ["Conservation", "/categories?facet=conservation"],
    ]);
  });

  it("links the help pages internally", () => {
    expect(NAV_GROUPS[2]?.items).toEqual([
      { label: "Contributing", href: "/help/contributing" },
      { label: "FAQ for bards", href: "/help/faq-for-bards" },
      {
        label: "Bard preference checklist",
        href: "/help/bard-preference-checklist",
      },
      {
        label: "Conservation status",
        href: "/help/conservation-status",
      },
      {
        label: "Licence & attribution",
        href: "/help/licence",
      },
    ]);
    expect(CONTRIBUTE_HREF).toBe("/help/contributing");
    expect(HELP_PAGES.map(({ slug }) => helpHref(slug))).toEqual(
      NAV_GROUPS[2]?.items.map(({ href }) => href)
    );
  });

  it("sends no navigation entry to the wiki", () => {
    for (const { href } of items) {
      expect(isWikiUrl(href), href).toBe(false);
      expect(href.startsWith("/"), href).toBe(true);
    }
  });

  it("names the contact form and the licence", () => {
    expect(CONTACT_FORM_URL).toBe("https://forms.gle/wUwWnMKtWZSUisWCA");
    expect(LICENCE_URL).toBe("https://creativecommons.org/licenses/by-sa/4.0/");
  });
});
