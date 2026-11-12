import { useLocation } from "react-router";
import { NotFound, Resting } from "~/components/ErrorPages";
import type { ReadFailure } from "~/catalogue/read-failure";

/**
 * The h1 of a failed catalogue read, which the route's `meta` titles the
 * page with too. `missing`, on an entity page, is what wasn’t found: "that
 * piece".
 */
export function failureTitle(
  failure: ReadFailure,
  missing = "that page"
): string {
  return failure.kind === "not_found"
    ? `We couldn’t find ${missing}`
    : "Bardic Torch is resting";
}

/**
 * A catalogue page that couldn't load (503, the route's ErrorBoundary
 * inside the shell): `not_found` (404, an entity page only) is the 404
 * page titled "We couldn’t find {missing}"; `try_again` is the Resting
 * page, with Try again.
 */
export function CatalogueError({
  failure,
  missing,
}: {
  readonly failure: ReadFailure;
  /** On an entity page, what a 404 didn't find: "that piece". */
  readonly missing?: string;
}) {
  const { pathname } = useLocation();
  return failure.kind === "not_found" ? (
    <NotFound pathname={pathname} title={failureTitle(failure, missing)} />
  ) : (
    <Resting />
  );
}
