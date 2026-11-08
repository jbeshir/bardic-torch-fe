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
import { UnderPageHead } from "~/components/ui/ErrorState";
import { HistoryView } from "~/components/HistoryView";
import { pieceHead, type PieceView } from "~/components/piece/PiecePage";
import { catalogueHeaders } from "~/catalogue/headers";
import { historyMeta, matchData } from "~/catalogue/history-meta";
import { thrownPageFailure } from "~/catalogue/read-failure";
import { useErrorReference } from "~/hooks/useErrorReference";
import { isSlug } from "~/schemas/address";
import { loadHistory } from "~/server/history.server";

/**
 * `/pieces/:slug/history`: the piece's approved revisions, newest first,
 * 50 a page (plan §4.11), under the piece's head (`pieceHead`). The layout
 * (`pieces.$slug.tsx`) loads the piece once and ignores the page
 * changing; this view's own read is the history alone.
 */

const MISSING = "that piece";
const LAYOUT = "routes/pieces.$slug";

const historyPath = (slug: string) => `/pieces/${slug}/history` as const;

export const headers = catalogueHeaders;

export function loader({ params, url, context }: LoaderFunctionArgs) {
  const address = params.slug ?? "";
  return loadHistory({
    url,
    context,
    entity: "piece",
    address,
    valid: isSlug,
    path: historyPath(address),
  });
}

export const meta: MetaFunction = args => {
  const layout = matchData(args, LAYOUT) as PieceView | undefined;
  return historyMeta(args, {
    name: layout?.piece.title,
    path: historyPath(args.params.slug ?? ""),
    missing: MISSING,
    restricted: layout?.piece.conservation_status === "restricted",
  });
};

export default function PieceHistoryRoute() {
  const { state, history } = useLoaderData<typeof loader>();
  const { piece } = useOutletContext<PieceView>();
  return (
    <EntityPage {...pieceHead(piece)}>
      <HistoryView
        state={state}
        history={history}
        path={historyPath(piece.slug)}
      />
    </EntityPage>
  );
}

/** The history couldn't load: said under the piece's head, if it loaded. */
export function ErrorBoundary() {
  const error = useRouteError();
  const view = useRouteLoaderData<PieceView>(LAYOUT);
  const failure = thrownPageFailure(error);
  const reference = useErrorReference(error, failure === null);
  const body = failure ? (
    <CatalogueError failure={failure} what="the history" missing={MISSING} />
  ) : (
    <ServerError title="We couldn’t load the history" reference={reference} />
  );
  return view ? (
    <EntityPage {...pieceHead(view.piece)}>
      <UnderPageHead>{body}</UnderPageHead>
    </EntityPage>
  ) : (
    body
  );
}
