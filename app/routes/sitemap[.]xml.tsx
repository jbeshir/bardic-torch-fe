import type { LoaderFunctionArgs } from "react-router";
import { sitemapIndex } from "~/server/sitemap.server";

/**
 * `/sitemap.xml`: the index of the sitemaps, which are
 * `/sitemap/{name}.xml`. It reads nothing from the API.
 */
export function loader({ request }: LoaderFunctionArgs) {
  return sitemapIndex(new URL(request.url).origin);
}
