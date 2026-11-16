import { RowTable } from "~/components/catalogue/RowTable";
import { EmptyState } from "~/components/ui/EmptyState";
import { Link } from "~/components/ui/Link";
import { formatDate } from "~/catalogue/format";
import { revisionCredit } from "~/catalogue/revision-credit";
import type { RevisionSummary } from "~/schemas/catalogue";

/**
 * An entity's approved revisions, newest first (plan §4.11): when, who
 * (`revisionCredit`), the summary (or "No summary") and a link to the
 * revision's changes; a table from md and cards below. Shared by every
 * entity's History view.
 */
export function RevisionHistory({
  revisions,
}: {
  readonly revisions: readonly RevisionSummary[];
}) {
  if (revisions.length === 0) {
    return (
      <EmptyState title="No history yet" headingLevel={3}>
        Changes to this page will be listed here.
      </EmptyState>
    );
  }
  return (
    <RowTable
      label="Revisions"
      rows={revisions}
      rowKey={revision => String(revision.id)}
      columns={[
        {
          header: "When",
          nowrap: true,
          cell: revision => (
            <time dateTime={revision.created_at}>
              {formatDate(revision.created_at)}
            </time>
          ),
        },
        { header: "Who", cell: revisionCredit },
        {
          header: "Summary",
          cell: revision =>
            revision.summary === "" ? (
              <span className="text-fg-subtle">No summary</span>
            ) : (
              revision.summary
            ),
        },
        {
          header: "Changes",
          nowrap: true,
          cell: revision => (
            <Link to={`/revisions/${revision.id}`} compact>
              View changes
              <span className="sr-only">, revision {revision.id}</span>
            </Link>
          ),
        },
      ]}
    />
  );
}
