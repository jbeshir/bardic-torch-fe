/**
 * What search engines may crawl. Only the production build is
 * indexable (`__INDEXABLE__`, set from the build mode in vite.config.ts and
 * checked by `npm run check:prod-build`): preview, e2e and development
 * builds say `Disallow: /` and send a noindex robots header on every
 * response (security-headers.server.ts).
 *
 * Production disallows only the routes that are not pages. The pages that
 * carry `noindex` (`/search`, histories, revisions, filtered lists) are not
 * disallowed, so a crawler can read their `noindex`.
 */
export function robotsTxt(origin: string): string {
  if (__INDEXABLE__) {
    return [
      "User-agent: *",
      "Disallow: /auth/",
      "Disallow: /api/",
      "Disallow: /resources/",
      "Disallow: /settings",
      "",
      `Sitemap: ${origin}/sitemap.xml`,
      "",
    ].join("\n");
  }
  return "User-agent: *\nDisallow: /\n";
}
