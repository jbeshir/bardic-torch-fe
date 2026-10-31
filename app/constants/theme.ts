/**
 * The colour theme a reader can choose (DESIGN §6.24). "system" follows the
 * device setting and is stored as the absence of the theme cookie.
 */
export const THEME_CHOICES = ["system", "light", "dark"] as const;

export type ThemeChoice = (typeof THEME_CHOICES)[number];

/** The route that saves the choice (POST only). */
export const THEME_ACTION = "/resources/theme";

/**
 * The fetcher that submits a choice. The toggle and the document root share
 * it, so both show a pending choice before the server answers.
 */
export const THEME_FETCHER_KEY = "theme";

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return THEME_CHOICES.some(choice => choice === value);
}
