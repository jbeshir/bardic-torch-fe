/**
 * Every link out of the site, and the site navigation. The
 * catalogue is on this site: the navigation's entries are internal paths.
 * The original wiki is named only here, for the help pages' attribution
 * (CC BY-SA), the footer's link and the 404 page's secondary link.
 * Links are marked as external from their
 * address (`externalKind` in components/ui/Link.tsx).
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

/** The catalogue's search: a GET form to `/search?q=`. */
export const SEARCH = { action: "/search", param: "q" } as const;

/** The original wiki's front page. */
export const WIKI_HOME_URL = wikiPageUrl("Main Page");

/** The contact, takedown and opt-out form, which also reports a link. */
export const CONTACT_FORM_URL = "/contact";

/** The form reporting a link: the contact form, of kind `link_report`. */
export const reportLinkHref = (url: string) =>
  `${CONTACT_FORM_URL}?${new URLSearchParams({ kind: "link_report", url })}`;

/** The pages that need work (R-18). */
export const NEEDS_WORK_PATH = "/needs-work";

/** The licence of the site's text. */
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
  /** An internal path, with the query that picks a section if it has one. */
  readonly href: string;
};

type NavGroup = {
  readonly heading: string;
  readonly items: readonly NavItem[];
};

const page = (label: string, href: string): NavItem => ({ label, href });

/** The ways to browse pieces: the sidebar's Facets. */
const FACETS: readonly NavItem[] = [
  page("Genre / kind", "/categories?facet=kind"),
  page("Mood", "/categories?facet=mood"),
  page("Topic", "/categories?facet=topic"),
  page("Culture", "/categories?facet=culture"),
  page("Language", "/categories?facet=language"),
  page("Legendaria", "/categories?facet=legendaria"),
  page("Origin", "/categories?facet=origin"),
  page("Conservation", "/categories?facet=conservation"),
];

/** The sidebar and drawer navigation, in order. */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    heading: "Browse",
    items: [
      page("Pieces", "/pieces"),
      page("Bards", "/bards"),
      page("Collections", "/collections"),
      page("Events and venues", "/events"),
      page("Categories", "/categories"),
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
