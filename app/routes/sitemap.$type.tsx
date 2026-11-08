import type { LoaderFunctionArgs } from "react-router";
import { sitemap } from "~/server/sitemap.server";

/**
 * `/sitemap/{name}.xml`: one sitemap of the index, `pages`, `pieces`,
 * `bards`, `categories`, `collections` or `events`. An unknown name is a
 * plain 404; an upstream failure is a 503 with `Retry-After`, never a
 * partial sitemap.
 */
export function loader({ request, params, context }: LoaderFunctionArgs) {
  return sitemap(context, new URL(request.url).origin, params.type);
}
