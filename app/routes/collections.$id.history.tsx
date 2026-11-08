import {
  useLoaderData,
  useParams,
  useRouteError,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { CatalogueError } from "~/components/catalogue/CatalogueError";
import { ServerError } from "~/components/ErrorPages";
import { HistoryView } from "~/components/HistoryView";
import { catalogueHeaders } from "~/catalogue/headers";
import { historyMeta, matchData } from "~/catalogue/history-meta";
import { thrownPageFailure } from "~/catalogue/read-failure";
import { useErrorReference } from "~/hooks/useErrorReference";
import { isEntityId } from "~/schemas/address";
import type { Collection } from "~/schemas/catalogue";
import { loadHistory } from "~/server/history.server";

/**
 * `/collections/:id/history`: the collection's approved revisions, newest
 * first, 50 a page (plan §4.11), under the head its layout shows. Its own
 * read is the history alone, and the layout ignores
 * the page changing.
 */

const MISSING = "that collection";
const LAYOUT = "routes/collections.$id";

const historyPath = (id: string) => `/collections/${id}/history` as const;

export const headers = catalogueHeaders;

export function loader({ params, url, context }: LoaderFunctionArgs) {
  const address = params.id ?? "";
  return loadHistory({
    url,
    context,
    entity: "collection",
    address,
    valid: isEntityId,
    path: historyPath(address),
  });
}

export const meta: MetaFunction = args => {
  const layout = matchData(args, LAYOUT) as
    { readonly collection: Collection } | undefined;
  return historyMeta(args, {
    name: layout?.collection.name,
    path: historyPath(args.params.id ?? ""),
    missing: MISSING,
  });
};

export default function CollectionHistoryRoute() {
  const { state, history } = useLoaderData<typeof loader>();
  const { id = "" } = useParams();
  return <HistoryView state={state} history={history} path={historyPath(id)} />;
}

/** The history couldn't load, under the head. */
export function ErrorBoundary() {
  const error = useRouteError();
  const failure = thrownPageFailure(error);
  const reference = useErrorReference(error, failure === null);
  return failure ? (
    <CatalogueError failure={failure} what="the history" missing={MISSING} />
  ) : (
    <ServerError title="We couldn’t load the history" reference={reference} />
  );
}
