import { captureException } from "@sentry/cloudflare";
import { isRouteErrorResponse, ServerRouter } from "react-router";
import type {
  EntryContext,
  HandleDataRequestFunction,
  HandleErrorFunction,
  RouterContextProvider,
} from "react-router";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import { NonceContext } from "~/contexts/NonceContext";
import { appEnvContext } from "~/server/context.server";
import {
  createNonce,
  withSecurityHeaders,
} from "~/server/security-headers.server";

/** Errors already reported: a render error reaches both handlers below. */
const reported = new WeakSet<object>();

/**
 * Errors are logged (Workers Logs) and reported to Sentry, which
 * workers/app.ts's `withSentry` sets up per request; without SENTRY_DSN
 * `captureException` does nothing. Each error object is reported once.
 */
function report(error: unknown): void {
  if (typeof error === "object" && error !== null) {
    if (reported.has(error)) return;
    reported.add(error);
  }
  console.error(error);
  captureException(error);
}

/**
 * What a loader or action throws (React Router renders the error
 * boundary). A request the reader abandoned is not an error, and neither is
 * a 4xx answer (React Router's own 405 for a form posted to a page without
 * an action).
 */
export const handleError: HandleErrorFunction = (error, { request }) => {
  if (request.signal.aborted) return;
  if (isRouteErrorResponse(error) && error.status < 500) return;
  report(error);
};

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext: RouterContextProvider
) {
  const nonce = createNonce();

  const body = await renderToReadableStream(
    <NonceContext value={nonce}>
      <ServerRouter context={routerContext} url={request.url} nonce={nonce} />
    </NonceContext>,
    {
      nonce,
      signal: request.signal,
      onError(error: unknown) {
        report(error);
        responseStatusCode = 500;
      },
    }
  );

  if (isbot(request.headers.get("user-agent") || "")) {
    await body.allReady;
  }

  const headers = withSecurityHeaders(responseHeaders, {
    env: loadContext.get(appEnvContext),
    nonce,
    development: import.meta.env.DEV,
  });
  headers.set("Content-Type", "text/html; charset=utf-8");
  return new Response(body, { headers, status: responseStatusCode });
}

export const handleDataRequest: HandleDataRequestFunction = (
  response,
  { context }
) =>
  new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: withSecurityHeaders(response.headers, {
      env: context.get(appEnvContext),
      nonce: createNonce(),
      development: import.meta.env.DEV,
    }),
  });
