import * as Sentry from "@sentry/remix";
import type {
  AppLoadContext,
  EntryContext,
  HandleDataRequestFunction,
} from "@remix-run/cloudflare";
import { RemixServer } from "@remix-run/react";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import { NonceContext } from "~/contexts/NonceContext";
import {
  createNonce,
  withSecurityHeaders,
} from "~/server/security-headers.server";

// Initialize Sentry for server-side error tracking
// Note: In Cloudflare Workers, initialization happens per-request
const initSentry = (context: AppLoadContext) => {
  const dsn = context.cloudflare?.env?.SENTRY_DSN;
  if (dsn && !Sentry.isInitialized()) {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
    });
  }
};

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
  loadContext: AppLoadContext
) {
  initSentry(loadContext);
  const nonce = createNonce();

  const body = await renderToReadableStream(
    <NonceContext.Provider value={nonce}>
      <RemixServer context={remixContext} url={request.url} nonce={nonce} />
    </NonceContext.Provider>,
    {
      nonce,
      signal: request.signal,
      onError(error: unknown) {
        console.error(error);
        Sentry.captureException(error);
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
