/**
 * How dates and numbers read in copy (DESIGN §11.1). Every count in a
 * sentence goes through `formatCount`, every bare number through
 * `formatNumber`, every API date through `formatDate`.
 */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * An API timestamp (or a `YYYY-MM-DD` date) as a date, "3 Oct 2026", on
 * the UTC day. Spelt out here rather than with Intl, so the server and
 * every browser (whatever its time zone or ICU data) render the same text
 * and hydration never disagrees.
 */
export function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()] ?? ""} ${date.getUTCFullYear()}`;
}

const NUMBER = new Intl.NumberFormat("en-GB");
const PLURAL = new Intl.PluralRules("en-GB");

/** A bare number, grouped: "1,205". */
export function formatNumber(n: number): string {
  return NUMBER.format(n);
}

/**
 * A count with its noun: "1 piece", "10,050 pieces", "0 pieces". The
 * plural is the singular plus "s" unless given ("person or group",
 * "people and groups").
 */
export function formatCount(
  n: number,
  singular: string,
  plural = `${singular}s`
): string {
  return `${formatNumber(n)} ${PLURAL.select(n) === "one" ? singular : plural}`;
}

/**
 * The home page's size line: "142 pieces and 61 people and groups so far".
 * Persons include groups, historical figures and stubs, so not "bards".
 */
export function formatCatalogueSize(pieces: number, people: number): string {
  const personOrGroup = formatCount(
    people,
    `person or ${"group"}`,
    "people and groups"
  );
  return `${formatCount(pieces, "piece")} and ${personOrGroup} so far`;
}
