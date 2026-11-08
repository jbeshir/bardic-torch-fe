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
