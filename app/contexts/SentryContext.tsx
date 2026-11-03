import * as Sentry from "@sentry/react";
import { useEffect, type ReactNode } from "react";
import { SENTRY_DATA_COLLECTION } from "~/constants/sentry";

type Integrations = NonNullable<
  Parameters<typeof Sentry.init>[0]
>["integrations"];

/**
 * Start the browser SDK (`@sentry/react`) once, and only with a DSN: without
 * one nothing is initialised and nothing is sent. Called by SentryProvider
 * and, before reporting, by error boundaries, whose effects run before the
 * provider's on a page that fails on its first render. It collects nothing
 * about the reader (`SENTRY_DATA_COLLECTION`).
 */
export function initSentry(
  dsn: string | undefined,
  integrations: Integrations = []
): void {
  if (!dsn || Sentry.isInitialized()) return;
  Sentry.init({
    dsn,
    integrations,
    tracesSampleRate: 0.1,
    dataCollection: SENTRY_DATA_COLLECTION,
  });
}

/**
 * Starts Sentry in the browser with the DSN from the root loader, with
 * page-load and navigation tracing. Spans are named by URL path: Sentry's
 * React Router integration names them by route only for a router it
 * creates or wraps, and React Router's HydratedRouter creates its own. The
 * root Layout renders it, so it is there on error pages too.
 */
export function SentryProvider({
  dsn,
  children,
}: {
  readonly dsn: string | undefined;
  readonly children: ReactNode;
}) {
  useEffect(() => {
    initSentry(dsn, [Sentry.browserTracingIntegration()]);
  }, [dsn]);

  return <>{children}</>;
}
