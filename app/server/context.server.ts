import { createContext as createRouterContext } from "react-router";
import type { AuthContextResult } from "./auth.server";
import type { AppEnv } from "./env.server";

/**
 * What the Worker (worker.server.ts) gives every request's loaders and
 * actions through React Router's context (React Router's `createContext`,
 * not React's). Neither key has a default, so a
 * request that skipped the Worker fails loudly instead of running unset.
 */

/** The request's validated environment (see `env.server.ts`). */
export const appEnvContext = createRouterContext<AppEnv>();

/**
 * Per-request auth cache, so all loaders share one auth result. This
 * prevents multiple refresh attempts with single-use refresh tokens when
 * React Router runs loaders in parallel.
 */
type AuthCache = {
  authContextPromise?: Promise<AuthContextResult>;
};

/** The request's auth cache: a fresh object per request. */
export const authCacheContext = createRouterContext<AuthCache>();
