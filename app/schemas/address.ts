/**
 * How catalogue entities and list pages are addressed: the API's paging
 * limits and slug rule, as the URL state (`app/catalogue/query-state.ts`)
 * and the route loaders check them before any call. `address.test.ts`
 * reads each value from the spec, so they can't drift from it.
 */

/** Rows per list page: the API's default `limit`. */
export const PAGE_SIZE = 50;

/** The largest `offset` the API accepts. */
const MAX_OFFSET = 10_000;

/**
 * The last page a list can show: the one whose offset is still at most
 * `MAX_OFFSET` (page 201 starts at 10,000).
 */
export const MAX_PAGE = Math.floor(MAX_OFFSET / PAGE_SIZE) + 1;

/** Runs of lower-case ASCII letters and digits joined by single hyphens. */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The longest slug, in characters. */
const SLUG_MAX = 191;

/** Whether `value` is a valid slug: a term, piece or person address. */
export function isSlug(value: string): boolean {
  return value.length <= SLUG_MAX && SLUG_PATTERN.test(value);
}
