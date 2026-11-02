import * as Sentry from "@sentry/react";
import { useRouteLoaderData } from "react-router";
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
    // As @sentry/remix's captureRemixErrorBoundaryError did: only errors
    // are reported, never an error response (a thrown `data()`), which the
    // server answered on purpose.
    const eventId =
      error instanceof Error
        ? Sentry.captureException(error, {
            mechanism: { handled: false, type: "react-router.error-boundary" },
          })
        : undefined;
    const shown = Sentry.isInitialized() ? eventId : undefined;
    // The reference arrives from Sentry, outside React: shown once the
    // effect is done, unless the error has changed by then.
    let current = true;
    queueMicrotask(() => {
      if (current) setReference(shown);
    });
    return () => {
      current = false;
    };
  }, [error, report, dsn]);
  return reference;
}
