/**
 * The colour theme a reader can choose. "system" follows the
 * device setting and is stored as the absence of the theme cookie.
 */
export const THEME_CHOICES = ["system", "light", "dark"] as const;

export type ThemeChoice = (typeof THEME_CHOICES)[number];

/** The route that saves the choice (POST only). */
export const THEME_ACTION = "/resources/theme";

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return THEME_CHOICES.some(choice => choice === value);
}
