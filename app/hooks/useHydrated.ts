import { useSyncExternalStore } from "react";

function subscribe(): () => void {
  return () => {};
}

/**
 * False in the server render and during hydration, true from then on, and
 * true straight away in anything mounted after hydration. Components use it
 * to swap their no-JS form for the enhanced one without a hydration
 * mismatch.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
