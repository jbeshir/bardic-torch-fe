import { useId } from "react";
import { ListPagination } from "~/components/catalogue/ListPagination";
import { RevisionHistory } from "~/components/RevisionHistory";
import { formatCount } from "~/catalogue/format";
import { historyQuery, type PageQueryState } from "~/catalogue/query-state";
import type { RevisionHistory as History } from "~/schemas/catalogue";

/**
 * An entity's History view under its head (plan §4.11): how many
 * revisions there are, the revisions (`RevisionHistory`) and their pages.
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
  return (
    <section aria-labelledby={headingId} className="not-prose">
      <h2 id={headingId} className="text-h3 text-fg">
        History
      </h2>
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
