/**
 * Every link out of the site, and the site navigation (DESIGN §5.3). The
 * catalogue arrives in FE2; until then Browse, the facets and the search
 * go to the original wiki, marked as external. This is the only app module
 * that names the wiki's host (test/repo-hygiene.test.ts), so the catalogue
 * launch only changes this file: an entry gets an internal `href`. Links
 * are marked as external from their address (`externalKind` in
 * components/ui/Link.tsx).
 */

const WIKI_ORIGIN = "https://bardictorch.miraheze.org";

/** A page on the original wiki, by its title ("Category:Moods"). */
export function wikiPageUrl(title: string): string {
  return `${WIKI_ORIGIN}/wiki/${encodeURIComponent(title.replaceAll(" ", "_")).replaceAll("%3A", ":")}`;
}

/** Whether `url` is on the original wiki (its links are marked as such). */
export function isWikiUrl(url: string): boolean {
  return url === WIKI_ORIGIN || url.startsWith(`${WIKI_ORIGIN}/`);
}

/** The original wiki's own search page. */
const WIKI_SEARCH_ACTION = `${WIKI_ORIGIN}/w/index.php`;

/** The wiki's results for `query` (the 404 page's "Look on the original wiki"). */
export function wikiSearchUrl(query: string): string {
  return `${WIKI_SEARCH_ACTION}?${new URLSearchParams({ search: query })}`;
}

/** The catalogue's search (DESIGN §6.26): a GET form to `/search?q=`. */
export const SEARCH = { action: "/search", param: "q" } as const;

/** The original wiki's front page. */
export const WIKI_HOME_URL = wikiPageUrl("Main Page");

/** The contact form, until the site has its own (FE4). */
export const CONTACT_FORM_URL = "https://forms.gle/wUwWnMKtWZSUisWCA";

/** The licence of the site's text (DESIGN §5.7). */
export const LICENCE_URL = "https://creativecommons.org/licenses/by-sa/4.0/";

/** The help index. */
export const HELP_HREF = "/help";

/**
 * The help pages, in the site navigation's order: each is at
 * /help/{slug} (app/content/help/pages.ts holds its content) and listed in
 * the sidebar under `label`.
 */
export const HELP_PAGES = [
  { slug: "contributing", label: "Contributing" },
  { slug: "faq-for-bards", label: "FAQ for bards" },
  { slug: "bard-preference-checklist", label: "Bard preference checklist" },
  { slug: "conservation-status", label: "Conservation status" },
  { slug: "licence", label: "Licence & attribution" },
] as const;

export type HelpSlug = (typeof HELP_PAGES)[number]["slug"];

/** The address of a help page. */
export function helpHref(slug: HelpSlug): string {
  return `${HELP_HREF}/${slug}`;
}

type NavItem = {
  readonly label: string;
  /** An internal path, or an absolute URL (the original wiki, for now). */
  readonly href: string;
};

type NavGroup = {
  readonly heading: string;
  readonly items: readonly NavItem[];
  /** Explains the external links, under the heading (the SidebarNote). */
  readonly note?: string;
};

const wiki = (label: string, title: string): NavItem => ({
  label,
  href: wikiPageUrl(title),
});

const page = (label: string, href: string): NavItem => ({ label, href });

/** The ways to browse pieces: the sidebar's Facets, the home page's chips. */
export const FACETS: readonly NavItem[] = [
  wiki("Genre / kind", "Category:Genres"),
  wiki("Mood", "Category:Moods"),
  wiki("Topic", "Category:Topics"),
  wiki("Culture", "Category:Cultures"),
  wiki("Language", "Category:Languages"),
  wiki("Legendaria", "Category:Legendaria"),
  wiki("Origin", "Category:Source_Category"),
  wiki("Conservation", "Category:Conservation_Status"),
];

/** The sidebar and drawer navigation, in order. */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    heading: "Browse",
    note: "The catalogue is on its way. Until it opens, these links go to the original Bardic Torch wiki.",
    items: [
      wiki("Pieces", "Category:Pieces"),
      wiki("Bards", "Category:Bards"),
      wiki("Collections", "Collections"),
    ],
  },
  { heading: "Facets", items: FACETS },
  {
    heading: "Help",
    items: HELP_PAGES.map(({ slug, label }) => page(label, helpHref(slug))),
  },
];

/** Where the ContributeCard's button goes. */
export const CONTRIBUTE_HREF = helpHref("contributing");
