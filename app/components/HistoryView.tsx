import { useId } from "react";
import { ListPagination } from "~/components/catalogue/ListPagination";
import { ResultsStatus } from "~/components/catalogue/ResultsStatus";
import { RevisionHistory } from "~/components/RevisionHistory";
import { formatCount } from "~/catalogue/format";
import { showingText } from "~/catalogue/paging";
import { historyQuery, type PageQueryState } from "~/catalogue/query-state";
import { useResultsFocus } from "~/hooks/useResultsFocus";
import type { RevisionHistory as History } from "~/schemas/catalogue";

/**
 * An entity's History view under its head (plan §4.11): how many
 * revisions there are, the revisions (`RevisionHistory`) and their pages,
 * with a status saying which page of them is shown.
 */
export function HistoryView({
  state,
  history,
  path,
}: {
  readonly state: PageQueryState;
  readonly history: History;
  /** The History view's own path, for its page links. */
  readonly path: string;
}) {
  const headingId = useId();
  // A new page of revisions replaces the page link used: focus goes to the
  // heading, and the status says which revisions these are.
  const headingRef = useResultsFocus(String(state.page));
  return (
    <section aria-labelledby={headingId} className="not-prose">
      <h2
        ref={headingRef}
        id={headingId}
        tabIndex={-1}
        className="text-h3 text-fg focus-visible:outline-hidden"
      >
        History
      </h2>
      <ResultsStatus>
        {history.total > 0
          ? showingText(
              state.page,
              history.data.length,
              history.total,
              "revision"
            )
          : "No revisions"}
      </ResultsStatus>
      <p className="mt-1 mb-4 text-body-sm text-fg-muted">
        {formatCount(history.total, "revision")}
      </p>
      <RevisionHistory revisions={history.data} />
      <div className="mt-6">
        <ListPagination
          page={state.page}
          total={history.total}
          href={page => historyQuery.href(path, page)}
        />
      </div>
    </section>
  );
}
