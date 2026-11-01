import * as Sentry from "@sentry/remix";
import { useLocation, useMatches } from "@remix-run/react";
import { useEffect, type ReactNode } from "react";

type Integrations = NonNullable<
  Parameters<typeof Sentry.init>[0]
>["integrations"];

/**
 * Start the browser SDK (`@sentry/remix`) once, and only with a DSN: without
 * one nothing is initialised and nothing is sent. Called by SentryProvider
 * and, before reporting, by error boundaries, whose effects run before the
 * provider's on a page that fails on its first render.
 */
export function initSentry(
  dsn: string | undefined,
  integrations: Integrations = []
): void {
  if (!dsn || Sentry.isInitialized()) return;
  Sentry.init({ dsn, integrations, tracesSampleRate: 0.1 });
}

/**
 * Starts Sentry in the browser with the DSN from the root loader, with
 * navigation tracing. The root Layout renders it, so it is there on error
 * pages too.
 */
export function SentryProvider({
  dsn,
  children,
}: {
  readonly dsn: string | undefined;
  readonly children: ReactNode;
}) {
  const location = useLocation();
  const matches = useMatches();

  useEffect(() => {
    initSentry(dsn, [
      Sentry.browserTracingIntegration({
        useEffect,
        useLocation: () => location,
        useMatches: () => matches,
      }),
    ]);
  }, [dsn, location, matches]);

  return <>{children}</>;
}
