import type { ReactNode } from "react";
import { Resting, ServerError } from "~/components/ErrorPages";
import { ButtonLink } from "~/components/ui/Button";
import { ErrorState, TryAgain } from "~/components/ui/ErrorState";
import type {
  FilterFailure,
  PageFailure,
  ReadFailure,
} from "~/catalogue/read-failure";
import { UNEXPECTED_ANSWER } from "~/schemas/proxy";

/**
 * The h1 of a failed catalogue read (plan §3.3), which the route's `meta`
 * titles the page with too. `what` names what didn't load: "the pieces".
 */
export function failureTitle(failure: ReadFailure, what: string): string {
  switch (failure.kind) {
    case "resting":
      return "Bardic Torch is resting";
    case "server":
      return `We couldn’t load ${what}`;
    case "bad_gateway":
      return "Something went wrong";
    case "search_timeout":
      return "That search took too long";
    case "invalid_filters":
      return "We couldn’t apply these filters";
  }
}

/**
 * A catalogue page that couldn't load at all (plan §3.3, DESIGN §10.5),
 * the route's ErrorBoundary inside the shell, by the failure's kind:
 * `resting` (the API is out of reach, 503) is the Resting page; `server`
 * (500) is "We couldn’t load {what}" with Try again; `bad_gateway` (502,
 * an answer we couldn't read) says so, with Try again.
 */
export function CatalogueError({
  failure,
  what,
}: {
  readonly failure: PageFailure;
  /** What failed to load, for the title: "the pieces". */
  readonly what: string;
}) {
  switch (failure.kind) {
    case "resting":
      return <Resting />;
    case "server":
      return (
        <ServerError
          title={failureTitle(failure, what)}
          reference={undefined}
        />
      );
    case "bad_gateway":
      return (
        <ErrorState
          title={failureTitle(failure, what)}
          actions={
            <>
              <TryAgain variant="primary" />
              <ButtonLink to="/">Go to the home page</ButtonLink>
            </>
          }
        >
          <p>{UNEXPECTED_ANSWER}</p>
        </ErrorState>
      );
  }
}

/**
 * A list whose search or filters failed (plan §3.3), shown by the page
 * itself, so the reader keeps the controls to change them (`children`:
 * the search box and the filter chips). `search_timeout` (500) says the
 * search was too slow and offers Try again; `invalid_filters` (400) says
 * a filter isn't valid and offers "Clear all filters".
 */
export function FilterError({
  failure,
  clearHref,
  children,
}: {
  readonly failure: FilterFailure;
  /** The list with no filters at all. */
  readonly clearHref: string;
  readonly children: ReactNode;
}) {
  const title = failureTitle(failure, "");
  return (
    <>
      {failure.kind === "search_timeout" ? (
        <ErrorState title={title} actions={<TryAgain variant="primary" />}>
          <p>Try fewer words or fewer filters, or browse by category.</p>
        </ErrorState>
      ) : (
        <ErrorState
          title={title}
          actions={
            <ButtonLink to={clearHref} variant="primary">
              Clear all filters
            </ButtonLink>
          }
        >
          <p>One of the filters in this link isn’t valid any more.</p>
        </ErrorState>
      )}
      <div className="grid gap-4">{children}</div>
    </>
  );
}
