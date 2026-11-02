import type { AppEnv } from "./app/server/env.server";
import type { AuthContextResult } from "./app/server/auth.server";

/** The validated environment (see `app/server/env.server.ts`). */
type Cloudflare = { env: AppEnv };

/**
 * Per-request auth cache to ensure all loaders share the same auth result.
 * This prevents multiple refresh attempts with single-use refresh tokens
 * when Remix runs loaders in parallel.
 */
type AuthCache = {
  authContextPromise?: Promise<AuthContextResult>;
};

declare module "@remix-run/cloudflare" {
  interface AppLoadContext {
    cloudflare: Cloudflare;
    authCache: AuthCache;
  }

  // Single fetch: `useLoaderData<typeof loader>` is what the loader returns
  // (unwrapped from `data()`), not its JSON serialisation.
  interface Future {
    v3_singleFetch: true;
  }
}
