import type { ShouldRevalidateFunctionArgs } from "react-router";

/**
 * An entity layout's `shouldRevalidate` (plan §1): its loader reads the
 * entity by its path alone, so a change of the search only (a history or
 * members `?page=`) leaves it be, while its children reload. Anything
 * else (another entity, Try again, a form) is React Router's default.
 */
export function ignoreSearchChanges({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs): boolean {
  if (
    currentUrl.pathname === nextUrl.pathname &&
    currentUrl.search !== nextUrl.search
  ) {
    return false;
  }
  return defaultShouldRevalidate;
}
