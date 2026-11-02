import { sentryPagesPlugin } from "@sentry/cloudflare";
import type { Env } from "../worker-configuration";
import { sentryOptions } from "../app/server/sentry.server";

/**
 * Server-side error reporting (plan §0.1): `@sentry/cloudflare`'s Pages
 * plugin runs every Function request in its own Sentry scope and reports
 * what it throws; entry.server's `handleError` and render `onError` report
 * what Remix catches. It needs AsyncLocalStorage, which wrangler.toml's
 * `nodejs_als` compatibility flag provides (not `nodejs_compat`).
 *
 * @public Pages runs it, by this name, before every Function request.
 */
export const onRequest = sentryPagesPlugin<Env>(context =>
  sentryOptions(context.env)
);
