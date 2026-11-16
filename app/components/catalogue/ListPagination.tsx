import { Pagination } from "~/components/ui/Pagination";
import { pageCount } from "~/catalogue/paging";

/**
 * The pages of a catalogue list (plan §2.2 rule 8): Pagination over its
 * pages. A list of one page has none.
 */
export function ListPagination({
  page,
  total,
  href,
}: {
  /** The current page, from 1. */
  readonly page: number;
  /** How many rows the list has over every page. */
  readonly total: number;
  /** The canonical link to page `n`. */
  readonly href: (n: number) => string;
}) {
  const count = pageCount(total);
  return (
    <div className="grid gap-3">
      {count > 1 ? (
        <Pagination page={page} pageCount={count} href={href} />
      ) : null}
    </div>
  );
}
