/**
 * How catalogue entities and list pages are addressed: the API's paging
 * limits and slug rule, as the URL state (`app/catalogue/query-state.ts`)
 * and the route loaders check them before any call. `address.test.ts`
 * reads each value from the spec, so they can't drift from it.
 */

/** Rows per list page: the API's default `limit`. */
export const PAGE_SIZE = 50;

/** Runs of lower-case ASCII letters and digits joined by single hyphens. */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The longest slug, in characters. */
const SLUG_MAX = 191;

/** Whether `value` is a valid slug: a term, piece or person address. */
export function isSlug(value: string): boolean {
  return value.length <= SLUG_MAX && SLUG_PATTERN.test(value);
}

/** A positive int64 in decimal, without leading zeros (its digits). */
const ENTITY_ID_PATTERN = /^[1-9][0-9]{0,18}$/;

/** The largest id the API takes: int64's maximum. */
const ENTITY_ID_MAX = 9_223_372_036_854_775_807n;

/**
 * Whether `value` is a valid collection or revision id: a positive int64
 * written in plain decimal (no sign, no leading zero), as the API reads it.
 */
export function isEntityId(value: string): boolean {
  return ENTITY_ID_PATTERN.test(value) && BigInt(value) <= ENTITY_ID_MAX;
}
