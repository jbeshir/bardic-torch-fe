import * as Sentry from "@sentry/remix";
import { useEffect, useState } from "react";

/**
 * Reports an error boundary's `error` to Sentry after it mounts (unless
 * `report` is false, e.g. for a 404) and returns the event id to show as
 * the page's reference, only when Sentry is set up to receive it.
 */
export function useErrorReference(
  error: unknown,
  report: boolean
): string | undefined {
  const [reference, setReference] = useState<string>();
  useEffect(() => {
    if (!report) return;
    const eventId = Sentry.captureRemixErrorBoundaryError(error);
    setReference(Sentry.isInitialized() ? eventId : undefined);
  }, [error, report]);
  return reference;
}
