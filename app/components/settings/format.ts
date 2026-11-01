import type { components } from "~/api/schema.gen";

type APIToken = components["schemas"]["APIToken"];

/**
 * A token's name for people (DESIGN §10.3): its own, or "Token {prefix}…"
 * when it has none, both on screen and in the names of its controls.
 */
export function tokenLabel(token: Pick<APIToken, "name" | "prefix">): string {
  return token.name ?? `Token ${token.prefix}…`;
}

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
 * An API timestamp as a date, "3 Oct 2026" (DESIGN §11.1), on the UTC day.
 * Spelt out here rather than with Intl, so the server and every browser
 * (whatever its time zone or ICU data) render the same text and hydration
 * never disagrees.
 */
export function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()] ?? ""} ${date.getUTCFullYear()}`;
}
