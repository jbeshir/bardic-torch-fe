import {
  useLoaderData,
  useParams,
  useRouteError,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { CatalogueError } from "~/components/catalogue/CatalogueError";
import { ServerError } from "~/components/ErrorPages";
import { UnderPageHead } from "~/components/ui/ErrorState";
import { HistoryView } from "~/components/HistoryView";
import { catalogueHeaders } from "~/catalogue/headers";
import { historyMeta, matchData } from "~/catalogue/history-meta";
import { thrownPageFailure } from "~/catalogue/read-failure";
import { useErrorReference } from "~/hooks/useErrorReference";
import { isSlug } from "~/schemas/address";
import type { Event } from "~/schemas/catalogue";
import { loadHistory } from "~/server/history.server";

/**
 * `/events/:slug/history`: the event's or venue's approved revisions, newest
 * first, 50 a page (plan §4.11), under the head its layout shows. Its own
 * read is the history alone, and the layout ignores
 * the page changing.
 */

const MISSING = "that event or venue";
const LAYOUT = "routes/events.$slug";

const historyPath = (slug: string) => `/events/${slug}/history` as const;

export const headers = catalogueHeaders;

export function loader({ params, url, context }: LoaderFunctionArgs) {
  const address = params.slug ?? "";
  return loadHistory({
    url,
    context,
    entity: "event",
    address,
    valid: isSlug,
    path: historyPath(address),
  });
}

export const meta: MetaFunction = args => {
  const layout = matchData(args, LAYOUT) as
    { readonly event: Event } | undefined;
  return historyMeta(args, {
    name: layout?.event.name,
    path: historyPath(args.params.slug ?? ""),
    missing: MISSING,
  });
};

export default function EventHistoryRoute() {
  const { state, history } = useLoaderData<typeof loader>();
  const { slug = "" } = useParams();
  return (
    <HistoryView state={state} history={history} path={historyPath(slug)} />
  );
}

/** The history couldn't load, under the head. */
export function ErrorBoundary() {
  const error = useRouteError();
  const failure = thrownPageFailure(error);
  const reference = useErrorReference(error, failure === null);
  return (
    <UnderPageHead>
      {failure ? (
        <CatalogueError failure={failure} missing={MISSING} />
      ) : (
        <ServerError
          title="We couldn’t load the history"
          reference={reference}
        />
      )}
    </UnderPageHead>
  );
}
