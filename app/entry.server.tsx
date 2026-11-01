import { captureException } from "@sentry/cloudflare";
import type {
  AppLoadContext,
  EntryContext,
  HandleDataRequestFunction,
  HandleErrorFunction,
} from "@remix-run/cloudflare";
import { RemixServer } from "@remix-run/react";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import { NonceContext } from "~/contexts/NonceContext";
import {
  createNonce,
  withSecurityHeaders,
} from "~/server/security-headers.server";

/**
 * Errors are logged (Cloudflare's real-time logs) and reported to Sentry,
 * which functions/_middleware.ts sets up per request; without SENTRY_DSN
 * `captureException` does nothing.
 */
function report(error: unknown): void {
  console.error(error);
  captureException(error);
}

/**
 * What a loader or action throws (Remix renders the error boundary). A
 * request the reader abandoned is not an error.
 */
export const handleError: HandleErrorFunction = (error, { request }) => {
  if (request.signal.aborted) return;
  report(error);
};

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
  loadContext: AppLoadContext
) {
  const nonce = createNonce();

  const body = await renderToReadableStream(
    <NonceContext.Provider value={nonce}>
      <RemixServer context={remixContext} url={request.url} nonce={nonce} />
    </NonceContext.Provider>,
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
    env: loadContext.cloudflare.env,
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
      env: context.cloudflare.env,
      nonce: createNonce(),
      development: import.meta.env.DEV,
    }),
  });
