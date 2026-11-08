import { Pagination } from "~/components/ui/Pagination";
import { formatNumber } from "~/catalogue/format";
import { isCapped, pageCount, SHOWN_MAX } from "~/catalogue/paging";

/**
 * The pages of a catalogue list (plan §2.2 rule 8): Pagination over the
 * pages the API serves, at most 201, and, when the list is longer than
 * that, a caption saying only the first 10,050 can be shown, suggesting a
 * narrower search only where one was made (`narrowable`). A list of one
 * page has neither.
 */
export function ListPagination({
  page,
  total,
  href,
  narrowable = false,
}: {
  /** The current page, from 1. */
  readonly page: number;
  /** How many rows the list has over every page. */
  readonly total: number;
  /** The canonical link to page `n`. */
  readonly href: (n: number) => string;
  /** A search or filter narrowed the list, so a narrower one can help. */
  readonly narrowable?: boolean;
}) {
  const count = pageCount(total);
  return (
    <div className="grid gap-3">
      {count > 1 ? (
        <Pagination page={page} pageCount={count} href={href} />
      ) : null}
      {isCapped(total) ? (
        <p className="text-caption text-fg-subtle">
          {narrowable
            ? `Showing the first ${formatNumber(SHOWN_MAX)}. Narrow your search to see the rest.`
            : `Only the first ${formatNumber(SHOWN_MAX)} can be listed.`}
        </p>
      ) : null}
    </div>
  );
}
