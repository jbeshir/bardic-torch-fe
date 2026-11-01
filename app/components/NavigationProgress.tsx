import { useNavigation } from "@remix-run/react";
import { useEffect, useState } from "react";

/** Navigations quicker than this show nothing, so the bar never flickers. */
const PROGRESS_DELAY_MS = 300;

/**
 * Whether a client-side navigation has been running for longer than
 * PROGRESS_DELAY_MS (DESIGN §7.1). Fetcher submissions aren't navigations
 * and don't count.
 */
export function useSlowNavigation(): boolean {
  const navigating = useNavigation().state !== "idle";
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!navigating) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), PROGRESS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [navigating]);
  return slow;
}

/**
 * The page-loading bar (DESIGN §7.1): 3 px of accent across the top of the
 * viewport, above the header. Decorative: `<main aria-busy>` is what tells
 * assistive tech. It sweeps when motion is allowed and stands still,
 * full width, when it isn't.
 */
export function NavigationProgress({ visible }: { readonly visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-progress h-progress overflow-hidden"
    >
      <div className="h-full w-full bg-accent motion-safe:animate-progress" />
    </div>
  );
}
