import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether the media query `query` matches, following it as it changes.
 * False in the server render and during hydration (the server can't
 * know), so a component can swap its no-JS form for the enhanced one
 * without a hydration mismatch; true or false from then on.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}
