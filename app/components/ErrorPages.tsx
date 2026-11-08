import { isRouteErrorResponse } from "react-router";
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

/** The resting page's title: the catalogue is out of reach, not broken. */
export const RESTING_META = [
  { title: "Bardic Torch is resting · Bardic Torch" },
  { name: "robots", content: "noindex" },
] as const;

/**
 * Whether a loader threw the resting answer, `data({kind: "resting"},
 * {status: 503})`: the API was down, unreachable or too slow.
 */
export function isResting(error: unknown): boolean {
  if (!isRouteErrorResponse(error)) return false;
  const body: unknown = error.data;
  return (
    typeof body === "object" &&
    body !== null &&
    "kind" in body &&
    body.kind === "resting"
  );
}

/**
 * The 404 page body (DESIGN §10.4): the unlit torch, what happened, the way
 * home and a search of the original wiki for the address's last part,
 * since its old pages don't redirect here yet.
 */
export function NotFound({ pathname }: { readonly pathname: string }) {
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
  readonly reference: string | undefined;
  readonly title?: string;
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

/**
 * The page body when the catalogue is out of reach (DESIGN §10.5, 503): the
 * API is down for upkeep, unreachable or too slow. The art is the unlit
 * torch, not the broken one, and there is no reference: an outage isn't
 * a bug to report (the server has logged it). Try again reloads without JS.
 */
export function Resting() {
  return (
    <ErrorState
      art="missing"
      title="Bardic Torch is resting"
      actions={
        <>
          <TryAgain variant="primary" />
          <ButtonLink to="/">Go to the home page</ButtonLink>
        </>
      }
    >
      <p>
        We’re doing some upkeep or the catalogue is briefly unreachable. Please
        try again in a few minutes.
      </p>
    </ErrorState>
  );
}
