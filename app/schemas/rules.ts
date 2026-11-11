/**
 * The API's rules for what people type, with their UI copy. The zod form schemas in `api.ts` (proxy routes) and the settings
 * forms (in the browser) check with these same functions, so both reject
 * the same values with the same words. No zod here: the browser bundle
 * doesn't need it.
 */

/** Longest display name the API keeps, in characters, after normalising. */
const DISPLAY_NAME_MAX = 64;
/** Longest display name the API reads, in characters, before normalising. */
const DISPLAY_NAME_INPUT_MAX = 256;

/** The display-name rule in full, for an upstream rejection of the name. */
export const DISPLAY_NAME_RULE = `Use 1 to ${DISPLAY_NAME_MAX} characters, without control or invisible formatting characters.`;
/** The display-name field's standing hint: the rule in plain words. */
export const DISPLAY_NAME_HINT = `Up to ${DISPLAY_NAME_MAX} characters.`;

const DISPLAY_NAME_MISSING = "Enter a display name.";
const DISPLAY_NAME_TOO_LONG = `Display names can be up to ${DISPLAY_NAME_MAX} characters.`;

/** Unicode control (Cc) and format (Cf) characters, such as U+202E. */
const CONTROL_OR_FORMAT = /[\p{Cc}\p{Cf}]/u;

/** Length in characters (code points), as the API counts it. */
function characterCount(value: string): number {
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
