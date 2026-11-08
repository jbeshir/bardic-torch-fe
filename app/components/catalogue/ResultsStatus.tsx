/**
 * What a list shows, said once it has loaded (plan §2.5): a polite status
 * region, out of sight, so a screen reader hears "Showing 12 pieces",
 * "Showing 51–100 of 249 pieces" (`showingText`, so each page reads
 * differently) or "No results" after a filter, a letter or a page changes
 * the list. Its text is the loader's, so it changes only when the new list
 * is in.
 */
export function ResultsStatus({ children }: { readonly children: string }) {
  return (
    <p role="status" className="sr-only">
      {children}
    </p>
  );
}
