import { redirect } from "react-router";
import { MAX_PAGE, PAGE_SIZE } from "~/schemas/address";
import { formatCount, formatNumber } from "./format";

/**
 * Paging past the data (plan §2.2 rule 8), the same on every paged route.
 * Whether a page exists depends on the list's `total`, so it is settled
 * after the fetch, in one 302 hop:
 *
 * - `page > MAX_PAGE` would be an offset the API refuses, so the loader
 *   first asks for the total (`isBeyondApi`), then redirects to the last
 *   page;
 * - a page past the last (`offset >= total > 0`) goes to the last page;
 * - any page of an empty list goes to the first (the URL without `page`).
 *
 * The page count is capped at `MAX_PAGE`, so Pagination never offers a
 * page the API would refuse; a list longer than that says so (`isCapped`).
 */

/** How many pages `total` rows fill, from 1, at most `MAX_PAGE`. */
export function pageCount(total: number): number {
  return Math.max(1, Math.min(Math.ceil(total / PAGE_SIZE), MAX_PAGE));
}

/** How many rows the pages can show: "Showing the first 10,050." */
export const SHOWN_MAX = MAX_PAGE * PAGE_SIZE;

/** Whether some of `total` rows are beyond the last page the API serves. */
export function isCapped(total: number): boolean {
  return total > SHOWN_MAX;
}

/** Whether `page` is beyond the offsets the API accepts. */
export function isBeyondApi(page: number): boolean {
  return page > MAX_PAGE;
}

/**
 * Send a request for a page past the data to the last page with rows (or
 * the first, for an empty list) with a 302: the list may grow again, so
 * the move isn't permanent. `href(n)` is the canonical link to page `n`.
 */
export function redirectPastTheEnd(
  page: number,
  total: number,
  href: (page: number) => string
): void {
  const last = pageCount(total);
  if (page > last) throw redirect(href(last), 302);
}

/**
 * What a page of a list shows, for its status region (WCAG 4.1.3), so a
 * new page is announced even when the total is the same: "Showing 51–100
 * of 249 pieces", or "Showing 12 pieces" when one page holds them all.
 * `shown` is how many rows this page has.
 */
export function showingText(
  page: number,
  shown: number,
  total: number,
  singular: string,
  plural?: string
): string {
  const count = formatCount(total, singular, plural);
  if (page === 1 && shown >= total) return `Showing ${count}`;
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = first + Math.max(shown, 1) - 1;
  return `Showing ${formatNumber(first)}–${formatNumber(last)} of ${count}`;
}
