import type { RouterContextProvider } from "react-router";
import { isBeyondApi, redirectPastTheEnd } from "~/catalogue/paging";
import {
  historyQuery,
  redirectIfNotCanonical,
  type PageQueryState,
} from "~/catalogue/query-state";
import { asPageFailure, throwPageFailure } from "~/catalogue/read-failure";
import type { RevisionHistory } from "~/schemas/catalogue";
import { listRevisions, type HistoryEntity } from "./catalogue.server";

type HistoryData = {
  readonly state: PageQueryState;
  readonly canonical: string;
  readonly history: RevisionHistory;
};

/**
 * The loader of an entity's History view (plan §4.11), the same for every
 * entity: the address checked (`valid`, before any call: our own 404
 * otherwise), the page canonical (301), the page past the data (302), and
 * a failed read thrown to the route's boundary (404 for an entity that
 * isn't there, as the head's own read would say too).
 */
export async function loadHistory({
  url,
  context,
  entity,
  address,
  valid,
  path,
}: {
  readonly url: URL;
  readonly context: Readonly<RouterContextProvider>;
  readonly entity: HistoryEntity;
  /** The entity's address, from the path. */
  readonly address: string;
  readonly valid: (address: string) => boolean;
  /** The History view's own path, for its page links. */
  readonly path: string;
}): Promise<HistoryData> {
  if (!valid(address)) throwPageFailure({ kind: "not_found" });
  const { state, canonical } = historyQuery.parse(url.searchParams);
  redirectIfNotCanonical(url, canonical);
  const pageHref = (page: number) => historyQuery.href(path, page);
  if (isBeyondApi(state.page)) {
    const first = await listRevisions(context, entity, address, {
      limit: 1,
      offset: 0,
    });
    if (!first.ok) throwPageFailure(asPageFailure(first.failure));
    redirectPastTheEnd(state.page, first.data.total, pageHref);
  }
  const result = await listRevisions(
    context,
    entity,
    address,
    historyQuery.toApi(state)
  );
  if (!result.ok) throwPageFailure(asPageFailure(result.failure));
  redirectPastTheEnd(state.page, result.data.total, pageHref);
  return { state, canonical, history: result.data };
}
