import { withSentry } from "@sentry/cloudflare";
import { sentryOptions } from "../app/server/sentry.server";
import { createWorkerHandler } from "../app/server/worker.server";

/**
 * The Worker. Requests for a static file (build/client) are served by
 * Cloudflare's static assets and never reach it; every other request is
 * rendered by React Router (app/server/worker.server.ts). `withSentry` gives
 * each request its own Sentry scope and reports what it throws;
 * entry.server's `handleError` and render `onError` report what React
 * Router catches. Sentry needs the `nodejs_compat` compatibility flag
 * (wrangler.jsonc).
 */
const handleRequest = createWorkerHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

const handler: ExportedHandler<Env> = {
  fetch: (request, env) => handleRequest(request, env),
};

/** @public Cloudflare runs it: wrangler.jsonc's `main`. */
export default withSentry(env => sentryOptions(env), handler);
