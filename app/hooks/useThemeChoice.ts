import { useFetcher, useRouteLoaderData } from "@remix-run/react";
import {
  isThemeChoice,
  THEME_FETCHER_KEY,
  type ThemeChoice,
} from "~/constants/theme";
import type { loader as rootLoader } from "~/root";
import type { action as themeAction } from "~/routes/resources.theme";

/**
 * The theme to show now: a choice still being saved wins, so the page
 * switches immediately; then the choice the server just saved (the root
 * loader doesn't run again for it); then the one the root loader read from
 * the cookie.
 */
export function useThemeChoice(): ThemeChoice {
  const loaded = useRouteLoaderData<typeof rootLoader>("root")?.theme;
  const fetcher = useFetcher<typeof themeAction>({ key: THEME_FETCHER_KEY });
  const pending = fetcher.formData?.get("theme");
  if (isThemeChoice(pending)) return pending;
  if (fetcher.data?.ok) return fetcher.data.theme;
  return loaded ?? "system";
}
