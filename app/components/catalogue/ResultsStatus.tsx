/**
 * What a list shows, said once it has loaded (plan §2.5): a polite status
 * region, so a screen reader hears "Showing 12 pieces", "Showing 51–100 of
 * 249 pieces" (`showingText`, so each page reads differently) or "No
 * results" after a filter, a letter or a page changes the list. Its text is
 * the loader's, so it changes only when the new list is in.
 *
 * With `visible` (a directory's list with rows) the count is
 * shown under the results heading, `body-sm fg-muted`; otherwise, and
 * always for "No results" (the EmptyState says it), it is out of sight. A
 * `note` (left-out filters, which an Alert above already shows) is said
 * after it, never shown.
 */
export function ResultsStatus({
  children,
  visible = false,
  note,
}: {
  readonly children: string;
  readonly visible?: boolean;
  /** Said after the count, out of sight: "Some categories … left them out." */
  readonly note?: string | undefined;
}) {
  return (
    <p
      role="status"
      className={
        visible ? "mt-1 text-body-sm text-fg-muted tabular-nums" : "sr-only"
      }
    >
      {children}
      {note === undefined ? null : (
        <span className="sr-only">{`. ${note}`}</span>
      )}
    </p>
  );
}
