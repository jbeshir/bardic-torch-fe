import { useId } from "react";
import { LINK_NOT_SHOWN } from "~/catalogue/restricted";
import type { RevisionChanges } from "~/catalogue/diff";
import { DiffRow } from "./DiffRow";

/**
 * A revision's changes (plan §4.11): "Changes" (or, with no base, "First
 * recorded version" and what it set), or `heading` when given, one
 * DiffRow per changed field. In a restricted piece's revision, a caption
 * first says why links are text.
 */
export function RevisionDiff({
  changes,
  heading,
}: {
  readonly changes: RevisionChanges;
  readonly heading?: string;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="mt-8">
      <h2 id={headingId} className="text-h3 text-fg">
        {heading ?? (changes.first ? "First recorded version" : "Changes")}
      </h2>
      {changes.first && heading === undefined ? (
        <p className="mt-1 text-body-sm text-fg-muted">
          These are the fields this revision set.
        </p>
      ) : null}
      {changes.linksAsText ? (
        <p className="mt-1 text-body-sm text-fg-muted">
          The creator asks that this piece isn’t shared further, so its links
          are shown as text only. {LINK_NOT_SHOWN}.
        </p>
      ) : null}
      {changes.rows.length === 0 ? (
        <p className="mt-3 text-body-sm text-fg-subtle">
          Nothing that is still shown changed in this revision.
        </p>
      ) : (
        <div className="mt-2">
          {changes.rows.map(row => (
            <DiffRow key={row.field} row={row} first={changes.first} />
          ))}
        </div>
      )}
    </section>
  );
}
