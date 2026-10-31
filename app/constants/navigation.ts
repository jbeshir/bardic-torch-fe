/**
 * Every link out of the site, and the site navigation (DESIGN §5.3). The
 * catalogue arrives in FE2; until then Browse, the facets and the search
 * go to the original wiki, marked as external. This is the only app module
 * that names the wiki's host (test/repo-hygiene.test.ts), so the catalogue
 * launch only changes this file: an entry flips `external` and `href`.
 */

const WIKI_ORIGIN = "https://bardictorch.miraheze.org";

/** A page on the original wiki, by its title ("Category:Moods"). */
export function wikiPageUrl(title: string): string {
  return `${WIKI_ORIGIN}/wiki/${encodeURIComponent(title.replaceAll(" ", "_")).replaceAll("%3A", ":")}`;
}

/** The original wiki's own search (DESIGN §6.26): a GET form. */
export const WIKI_SEARCH = {
  action: `${WIKI_ORIGIN}/w/index.php`,
  param: "search",
} as const;

/** The wiki's results for `query` (the 404 page's "Look on the original wiki"). */
export function wikiSearchUrl(query: string): string {
  return `${WIKI_SEARCH.action}?${new URLSearchParams({ [WIKI_SEARCH.param]: query })}`;
}

/** The original wiki's front page. */
export const WIKI_HOME_URL = wikiPageUrl("Main Page");

/** The contact form, until the site has its own (FE4). */
export const CONTACT_FORM_URL = "https://forms.gle/wUwWnMKtWZSUisWCA";

/** The licence of the site's text (DESIGN §5.7). */
export const LICENCE_URL = "https://creativecommons.org/licenses/by-sa/4.0/";

type NavItem = {
  readonly label: string;
  readonly href: string;
  /** True while the target is on the original wiki. */
  readonly external: boolean;
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
  external: true,
});

const page = (label: string, href: string): NavItem => ({
  label,
  href,
  external: false,
});

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
  {
    heading: "Facets",
    items: [
      wiki("Genre / kind", "Category:Genres"),
      wiki("Mood", "Category:Moods"),
      wiki("Topic", "Category:Topics"),
      wiki("Culture", "Category:Cultures"),
      wiki("Language", "Category:Languages"),
      wiki("Legendaria", "Category:Legendaria"),
      wiki("Origin", "Category:Source_Category"),
      wiki("Conservation", "Category:Conservation_Status"),
    ],
  },
  {
    heading: "Help",
    items: [
      page("Contributing", "/help/contributing"),
      page("FAQ for bards", "/help/faq-for-bards"),
      page("Bard preference checklist", "/help/bard-preference-checklist"),
      page("Conservation status", "/help/conservation-status"),
      page("Licence & attribution", "/help/licence"),
    ],
  },
];

/** Where the ContributeCard's button goes. */
export const CONTRIBUTE_HREF = "/help/contributing";
