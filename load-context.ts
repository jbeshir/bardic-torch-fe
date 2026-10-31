import type { Env } from "./worker-configuration";
import type { AuthContextResult } from "./app/server/auth.server";

type Cloudflare = { env: Env };

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
}
