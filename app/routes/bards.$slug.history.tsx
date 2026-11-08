import {
  useLoaderData,
  useOutletContext,
  useRouteError,
  useRouteLoaderData,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { CatalogueError } from "~/components/catalogue/CatalogueError";
import { EntityPage } from "~/components/EntityPage";
import { ServerError } from "~/components/ErrorPages";
import { HistoryView } from "~/components/HistoryView";
import { personHead, type PersonView } from "~/components/person/PersonPage";
import { catalogueHeaders } from "~/catalogue/headers";
import { historyMeta, matchData } from "~/catalogue/history-meta";
import { thrownPageFailure } from "~/catalogue/read-failure";
import { useErrorReference } from "~/hooks/useErrorReference";
import { isSlug } from "~/schemas/address";
import { loadHistory } from "~/server/history.server";

/**
 * `/bards/:slug/history`: the person's approved revisions, newest first,
 * 50 a page (plan §4.11), under their head (`personHead`). The layout
 * (`bards.$slug.tsx`) loads the person once and ignores the page
 * changing; this view's own read is the history alone. A person who asked
 * not to have a page has no History tab (plan R8), but their history is
 * public, so this address still works.
 */

const MISSING = "that bard";
const LAYOUT = "routes/bards.$slug";

const historyPath = (slug: string) => `/bards/${slug}/history` as const;

export const headers = catalogueHeaders;

export function loader({ params, url, context }: LoaderFunctionArgs) {
  const address = params.slug ?? "";
  return loadHistory({
    url,
    context,
    entity: "person",
    address,
    valid: isSlug,
    path: historyPath(address),
  });
}

export const meta: MetaFunction = args => {
  const layout = matchData(args, LAYOUT) as PersonView | undefined;
  return historyMeta(args, {
    name: layout?.person.name,
    path: historyPath(args.params.slug ?? ""),
    missing: MISSING,
  });
};

export default function BardHistoryRoute() {
  const { state, history } = useLoaderData<typeof loader>();
  const { person } = useOutletContext<PersonView>();
  return (
    <EntityPage {...personHead(person)}>
      <HistoryView
        state={state}
        history={history}
        path={historyPath(person.slug)}
      />
    </EntityPage>
  );
}

/** The history couldn't load: said under the person's head, if it loaded. */
export function ErrorBoundary() {
  const error = useRouteError();
  const view = useRouteLoaderData<PersonView>(LAYOUT);
  const failure = thrownPageFailure(error);
  const reference = useErrorReference(error, failure === null);
  const body = failure ? (
    <CatalogueError failure={failure} what="the history" missing={MISSING} />
  ) : (
    <ServerError title="We couldn’t load the history" reference={reference} />
  );
  return view ? (
    <EntityPage {...personHead(view.person)}>{body}</EntityPage>
  ) : (
    body
  );
}
