import { useFetcher, useRouteLoaderData } from "@remix-run/react";
import {
  isThemeChoice,
  THEME_FETCHER_KEY,
  type ThemeChoice,
} from "~/constants/theme";
import type { loader as rootLoader } from "~/root";
import type { action as themeAction } from "~/routes/resources.theme";

/**
 * The theme to show now: a choice still being saved wins over the one the
 * root loader read from the cookie, so the page switches immediately.
 */
export function useThemeChoice(): ThemeChoice {
  const saved = useRouteLoaderData<typeof rootLoader>("root")?.theme;
  const pending = useFetcher<typeof themeAction>({
    key: THEME_FETCHER_KEY,
  }).formData?.get("theme");
  if (isThemeChoice(pending)) return pending;
  return saved ?? "system";
}
