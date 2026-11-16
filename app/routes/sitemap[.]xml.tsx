import type { LoaderFunctionArgs } from "react-router";
import { sitemap } from "~/server/sitemap.server";

/** `/sitemap.xml`: one sitemap of every public page. */
export function loader({ request, context }: LoaderFunctionArgs) {
  return sitemap(context, new URL(request.url).origin);
}
