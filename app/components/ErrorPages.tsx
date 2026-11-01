import { ButtonLink } from "~/components/ui/Button";
import { ErrorState, TryAgain } from "~/components/ui/ErrorState";
import { Link } from "~/components/ui/Link";
import { wikiSearchUrl } from "~/constants/navigation";

/** The last segment of a path, decoded, to search the old wiki for. */
function lastSegment(pathname: string): string {
  const segment = pathname.split("/").filter(Boolean).at(-1) ?? "";
  try {
    return decodeURIComponent(segment).replaceAll(/[_-]+/g, " ");
  } catch {
    return segment;
  }
}

/** The 404 page's title, kept out of search results. */
export const NOT_FOUND_META = [
  { title: "Page not found · Bardic Torch" },
  { name: "robots", content: "noindex" },
] as const;

/**
 * The title of the page for anything unexpected (WCAG 2.4.2): a route that
 * failed has no data to title itself with.
 */
export const SERVER_ERROR_META = [
  { title: "Something went wrong · Bardic Torch" },
  { name: "robots", content: "noindex" },
] as const;

/**
 * The 404 page body (DESIGN §10.4): the unlit torch, what happened, the way
 * home and a search of the original wiki for the address's last part,
 * since its old pages don't redirect here yet.
 */
export function NotFound({ pathname }: { pathname: string }) {
  return (
    <ErrorState
      art="missing"
      title="We couldn’t find that page"
      actions={
        <>
          <ButtonLink to="/" variant="primary">
            Go to the home page
          </ButtonLink>
          <Link to={wikiSearchUrl(lastSegment(pathname))}>
            Look on the original wiki
          </Link>
        </>
      }
    >
      <p>
        It may have moved, or the link may be mistyped. Bardic Torch is new, so
        pages from the old wiki don’t redirect here yet.
      </p>
    </ErrorState>
  );
}

/**
 * The page body for anything unexpected (DESIGN §10.5). `reference` is the
 * Sentry event id, when Sentry is set up; without one the request to
 * quote it is left out. "Let us know" is the Contact link in HelpLinks.
 * A route's own boundary may say what failed in `title`.
 */
export function ServerError({
  reference,
  title = "Something went wrong",
}: {
  reference: string | undefined;
  title?: string;
}) {
  return (
    <ErrorState
      title={title}
      reference={reference}
      actions={
        <>
          <TryAgain variant="primary" />
          <ButtonLink to="/">Go to the home page</ButtonLink>
        </>
      }
    >
      <p>
        That’s on us, not you. Try again in a moment.
        {reference
          ? " If it keeps happening, let us know and include the reference below."
          : null}
      </p>
    </ErrorState>
  );
}
