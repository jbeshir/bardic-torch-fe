import type { components } from "~/api/schema.gen";

type APIToken = components["schemas"]["APIToken"];

type Named = Pick<APIToken, "name" | "prefix">;

/** What a token without a name is called (DESIGN §10.3): "token {prefix}…". */
function unnamed(word: "Token" | "token", prefix: string): string {
  return `${word} ${prefix}…`;
}

/** The token's name, or null when it has none (missing or empty). */
function nameOf(token: Named): string | null {
  return token.name ? token.name : null;
}

/**
 * A token's name for people: its own, or "Token {prefix}…" when it has
 * none, both on screen and in the names of its controls.
 */
export function tokenLabel(token: Named): string {
  return nameOf(token) ?? unnamed("Token", token.prefix);
}

/** The same, inside a sentence: "‘Laptop MCP’", or "token {prefix}…". */
export function tokenInSentence(token: Named): string {
  const name = nameOf(token);
  return name ? `‘${name}’` : unnamed("token", token.prefix);
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
