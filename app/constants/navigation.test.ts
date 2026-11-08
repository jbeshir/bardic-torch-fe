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
 * The titles of the original wiki's categories (and the two plain pages the
 * site links to), snapshotted from the wiki dump by
 * scripts/wiki-categories.mjs. A link to a title missing here would be a
 * dead link on the wiki.
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

  it.each(items.filter(item => isWikiUrl(item.href)))(
    "$label goes to a page that exists on the wiki",
    ({ href }) => {
      const title = wikiTitle(href);
      expect(title, href).not.toBeNull();
      expect(existsOnWiki(title ?? ""), `${title} on the wiki`).toBe(true);
    }
  );

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
  it("has Browse, Facets and Help in that order, with the wiki note on Browse", () => {
    expect(NAV_GROUPS.map(group => group.heading)).toEqual([
      "Browse",
      "Facets",
      "Help",
    ]);
    expect(NAV_GROUPS[0]?.note).toBe(
      "The catalogue is on its way. Until it opens, these links go to the original Bardic Torch wiki."
    );
  });

  it("lists the catalogue entries from the plan, all on the wiki", () => {
    expect(
      NAV_GROUPS.slice(0, 2).flatMap(group =>
        group.items.map(({ label, href }) => [
          label,
          wikiTitle(href),
          isWikiUrl(href),
        ])
      )
    ).toEqual([
      ["Pieces", "Category:Pieces", true],
      ["Bards", "Category:Bards", true],
      ["Collections", "Collections", true],
      ["Genre / kind", "Category:Genres", true],
      ["Mood", "Category:Moods", true],
      ["Topic", "Category:Topics", true],
      ["Culture", "Category:Cultures", true],
      ["Language", "Category:Languages", true],
      ["Legendaria", "Category:Legendaria", true],
      ["Origin", "Category:Source Category", true],
      ["Conservation", "Category:Conservation Status", true],
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

  it("leaves the wiki for every absolute URL, and only for those", () => {
    for (const { href } of items) {
      expect(isWikiUrl(href), href).toBe(/^https:\/\//.test(href));
    }
  });

  it("names the contact form and the licence", () => {
    expect(CONTACT_FORM_URL).toBe("https://forms.gle/wUwWnMKtWZSUisWCA");
    expect(LICENCE_URL).toBe("https://creativecommons.org/licenses/by-sa/4.0/");
  });
});
