import type { MetaDescriptor, ShouldRevalidateFunction } from "react-router";
import { failureTitle } from "~/components/catalogue/CatalogueError";
import { SERVER_ERROR_META } from "~/components/ErrorPages";
import { thrownPageFailure } from "./read-failure";

/**
 * What an entity's layout route (`pieces.$slug`, `bards.$slug`) shares: it
 * loads the entity once for its Read and History views.
 */

/**
 * The layout's `shouldRevalidate`: a search-only change (another history
 * page) doesn't load the entity again; a new address, Try again (the same
 * URL) and anything else does as React Router would.
 */
export const ignoreSearchChanges: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}) =>
  currentUrl.pathname === nextUrl.pathname &&
  currentUrl.search !== nextUrl.search
    ? false
    : defaultShouldRevalidate;

/**
 * The meta of an entity page that failed: titled like its boundary's h1
 * ("We couldn’t find that piece") and kept out of search results; anything
 * unexpected is a server error.
 */
export function failureMeta(
  error: unknown,
  what: string,
  missing: string
): MetaDescriptor[] {
  const thrown = thrownPageFailure(error);
  if (!thrown) return [...SERVER_ERROR_META];
  return [
    { title: `${failureTitle(thrown, what, missing)} · Bardic Torch` },
    { name: "robots", content: "noindex" },
  ];
}
