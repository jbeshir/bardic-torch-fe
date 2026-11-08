import type { MetaArgs, MetaDescriptor } from "react-router";

const SITE_NAME = "Bardic Torch";

/** Search results show about this much of a description. */
const DESCRIPTION_MAX = 160;

type Robots = "noindex" | "noindex, follow" | "noindex, nofollow";

type PageMeta = {
  /** The page's own title; omitted on the home page, titled by the site alone. */
  readonly title?: string | undefined;
  /** What the page is, for search results: cut to 160 characters. */
  readonly description: string;
  /**
   * The canonical path, e.g. `/help/licence`, with a list page's canonical
   * query (`/pieces?letter=T`); never a fragment.
   */
  readonly path: `/${string}`;
  readonly robots?: Robots | undefined;
  readonly type?: "website" | "profile" | undefined;
  /** The social preview line, when it differs from the description. */
  readonly preview?: string | undefined;
  /**
   * The page's schema.org description (JSON-LD, plan §4.5), given the
   * site's origin for its absolute URLs; left out without one.
   */
  readonly structuredData?:
    ((origin: string) => Readonly<Record<string, unknown>>) | undefined;
};

/**
 * `text` on one line, cut at a word to fit the description's 160
 * characters, with "…" when anything was left out.
 */
function clampDescription(text: string): string {
  const flat = text.trim().replace(/\s+/g, " ");
  if (flat.length <= DESCRIPTION_MAX) return flat;
  // One character is kept for the "…".
  const cut = flat.slice(0, DESCRIPTION_MAX - 1);
  const endsOnWord = flat[DESCRIPTION_MAX - 1] === " ";
  const lastSpace = cut.lastIndexOf(" ");
  const words = endsOnWord || lastSpace <= 0 ? cut : cut.slice(0, lastSpace);
  return `${words.replace(/[\s,;:–—-]+$/u, "")}…`;
}

/** The site's origin, from the root loader (the request URL's origin). */
function siteOrigin(matches: MetaArgs["matches"]): string | undefined {
  const root: unknown = matches.find(match => match?.id === "root")?.loaderData;
  if (
    typeof root === "object" &&
    root !== null &&
    "siteOrigin" in root &&
    typeof root.siteOrigin === "string"
  ) {
    return root.siteOrigin;
  }
  return undefined;
}

/**
 * Every page's meta, written one way: the title ("{title} · Bardic Torch"),
 * the description (at most 160 characters), the absolute canonical link,
 * the Open Graph and Twitter card tags for a link preview, and robots when
 * the page shouldn't be indexed. Use it from a route's `meta` with the meta
 * args, which carry the root loader's `siteOrigin`.
 */
export function pageMeta(
  { matches }: Pick<MetaArgs, "matches">,
  {
    title,
    description,
    path,
    robots,
    type = "website",
    preview = description,
    structuredData,
  }: PageMeta
): MetaDescriptor[] {
  const origin = siteOrigin(matches);
  const url = origin ? new URL(path, origin).href : undefined;
  return [
    { title: title ? `${title} · ${SITE_NAME}` : SITE_NAME },
    { name: "description", content: clampDescription(description) },
    ...(url ? [{ tagName: "link", rel: "canonical", href: url }] : []),
    { property: "og:title", content: title ?? SITE_NAME },
    { property: "og:description", content: clampDescription(preview) },
    ...(url ? [{ property: "og:url", content: url }] : []),
    { property: "og:type", content: type },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:locale", content: "en_GB" },
    { name: "twitter:card", content: "summary" },
    ...(robots ? [{ name: "robots", content: robots }] : []),
    // A JSON data block, rendered escaped in the head; it is never run, so
    // the CSP needs no nonce for it.
    ...(origin && structuredData
      ? [{ "script:ld+json": structuredData(origin) }]
      : []),
  ];
}
