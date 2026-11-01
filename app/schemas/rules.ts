/**
 * The API's rules for what people type, with their UI copy (DESIGN §10.3,
 * §11.2). The zod form schemas in `api.ts` (proxy routes) and the settings
 * forms (in the browser) check with these same functions, so both reject
 * the same values with the same words. No zod here: the browser bundle
 * doesn't need it.
 */

/** Longest display name the API keeps, in characters, after normalising. */
export const DISPLAY_NAME_MAX = 64;
/** Longest display name the API reads, in characters, before normalising. */
const DISPLAY_NAME_INPUT_MAX = 256;
/** Longest API token name the API keeps, in characters, after trimming. */
export const TOKEN_NAME_MAX = 128;
/** How many active API tokens one user may have. */
export const ACTIVE_TOKEN_LIMIT = 10;

/** The display-name rule as UI copy, for hints and upstream rejections. */
export const DISPLAY_NAME_RULE = `Use 1 to ${DISPLAY_NAME_MAX} characters, without control or invisible formatting characters.`;
/** The token-name rule as UI copy. */
export const TOKEN_NAME_RULE = `Use ${TOKEN_NAME_MAX} characters or fewer, or leave the name blank.`;

const DISPLAY_NAME_MISSING = "Enter a display name.";
const DISPLAY_NAME_TOO_LONG = `Display names can be up to ${DISPLAY_NAME_MAX} characters.`;

/** Unicode control (Cc) and format (Cf) characters, such as U+202E. */
const CONTROL_OR_FORMAT = /[\p{Cc}\p{Cf}]/u;

/** Length in characters (code points), as the API counts it. */
export function characterCount(value: string): number {
  return [...value].length;
}

/** A display name as the API stores it: NFC-normalised and trimmed. */
export function normaliseDisplayName(value: string): string {
  return value.normalize("NFC").trim();
}

/** What is wrong with a display name as typed, or null if the API takes it. */
export function displayNameProblem(value: string | undefined): string | null {
  if (value === undefined) return DISPLAY_NAME_MISSING;
  if (characterCount(value) > DISPLAY_NAME_INPUT_MAX) {
    return DISPLAY_NAME_TOO_LONG;
  }
  const name = normaliseDisplayName(value);
  if (name === "") return DISPLAY_NAME_MISSING;
  if (characterCount(name) > DISPLAY_NAME_MAX) return DISPLAY_NAME_TOO_LONG;
  if (CONTROL_OR_FORMAT.test(name)) {
    return "Display names can’t contain control or invisible formatting characters.";
  }
  return null;
}

/** What is wrong with a token name as typed (blank is fine), or null. */
export function tokenNameProblem(value: string): string | null {
  return characterCount(value.trim()) > TOKEN_NAME_MAX
    ? `Token names can be up to ${TOKEN_NAME_MAX} characters.`
    : null;
}
