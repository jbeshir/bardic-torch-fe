import type { MetaDescriptor, ShouldRevalidateFunction } from "react-router";
import { failureTitle } from "~/components/catalogue/CatalogueError";
import { thrownPageFailure } from "./read-failure";

/**
 * What an entity's layout route shares (`pieces.$slug`, `bards.$slug`,
 * `categories.$slug`, `collections.$id`, `events.$slug`): it loads the
 * entity once for its Read and History views.
 */

/**
 * The layout's `shouldRevalidate` (plan §1): its loader reads the entity
 * by its path alone, so a search-only change (a history or members
 * `?page=`) doesn't load it again, while its children reload; a new
 * address, Try again (the same URL) and anything else does as React Router
 * would.
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
 * The meta of a page that failed: titled like its boundary's h1 ("We
 * couldn’t find that piece") and kept out of search results; anything
 * unexpected is "We couldn’t load {what}" as the boundary says.
 */
export function failureMeta(
  error: unknown,
  what: string,
  missing?: string
): MetaDescriptor[] {
  const failure = thrownPageFailure(error);
  const title = failure
    ? failureTitle(failure, missing)
    : `We couldn’t load ${what}`;
  return [
    { title: `${title} · Bardic Torch` },
    { name: "robots", content: "noindex" },
  ];
}
