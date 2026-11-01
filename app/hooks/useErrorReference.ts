import * as Sentry from "@sentry/remix";
import { useRouteLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { initSentry } from "~/contexts/SentryContext";
import type { loader as rootLoader } from "~/root";

/**
 * Reports an error boundary's `error` to Sentry after it mounts (unless
 * `report` is false, e.g. for a 404) and returns the event id to show as
 * the page's reference, only when Sentry is set up to receive it. Sentry is
 * started first if it isn't yet: on a page that fails on its first render,
 * this effect runs before SentryProvider's.
 */
export function useErrorReference(
  error: unknown,
  report: boolean
): string | undefined {
  const dsn = useRouteLoaderData<typeof rootLoader>("root")?.sentryDsn;
  const [reference, setReference] = useState<string>();
  useEffect(() => {
    if (!report) return;
    initSentry(dsn);
    const eventId = Sentry.captureRemixErrorBoundaryError(error);
    setReference(Sentry.isInitialized() ? eventId : undefined);
  }, [error, report, dsn]);
  return reference;
}
