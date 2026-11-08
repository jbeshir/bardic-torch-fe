import type { LoaderFunctionArgs } from "react-router";
import { robotsTxt } from "~/server/indexing.server";

/**
 * `/robots.txt` (plan C10.1): the rules for this build (see
 * app/server/indexing.server.ts), with the sitemap's address on this
 * request's origin. A resource route, so it has no root data and isn't
 * personalised.
 */
export function loader({ request }: LoaderFunctionArgs) {
  return new Response(robotsTxt(new URL(request.url).origin), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
