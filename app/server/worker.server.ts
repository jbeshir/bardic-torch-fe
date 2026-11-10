import {
  createRequestHandler,
  matchPath,
  RouterContextProvider,
  type RequestHandler,
  type ServerBuild,
} from "react-router";
import { appEnvContext, authCacheContext } from "./context.server";
import { configurationErrorResponse, parseEnv } from "./env.server";
import {
  createNonce,
  withSecurityHeaders,
  withStaticPageHeaders,
} from "./security-headers.server";

/**
 * The server build module (`virtual:react-router/server-build`). React
 * Router's typegen declares every export, the optional ones as possibly
 * undefined, which exactOptionalPropertyTypes tells apart from an absent
 * `ServerBuild` key; React Router reads both the same way.
 */
type ServerBuildModule = {
  readonly [Key in keyof ServerBuild]-?: ServerBuild[Key] | undefined;
};

/** The Worker's `fetch`: a request and its raw bindings. */
type WorkerFetch = (request: Request, env: unknown) => Promise<Response>;

/**
 * The request methods React Router treats as actions, which its own CSRF
 * check covers (`isMutationMethod`).
 */
const ACTION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * The resource routes: routes without a component. React Router checks the
 * origin of actions on every other route (documents and single fetch
 * `.data` requests); these check it themselves (`assertSameOrigin`, a 403 in
 * JSON). worker.server.test.ts checks this is exactly the routes without a
 * component in app/routes, so it can't drift.
 */
const RESOURCE_ROUTE_PATHS: readonly string[] = [
  "/api/me",
  "/auth/callback",
  "/auth/login",
  "/auth/logout",
  "/resources/theme",
  "/robots.txt",
  "/sitemap.xml",
];

/**
 * Whether React Router would refuse `request` as a potential CSRF attack
 * (`throwIfPotentialCSRFAttack`, the same predicate): an action whose
 * `Origin` header is present and isn't the request's own origin
 * (`Origin: null` and a value that isn't a URL included), on a route React
 * Router checks: every `.data` URL, and every path but a resource route's.
 */
function isCrossOriginAction(request: Request, url: URL): boolean {
  if (!ACTION_METHODS.has(request.method.toUpperCase())) return false;
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  const sameOrigin =
    origin === "null"
      ? origin === url.host
      : URL.canParse(origin) && new URL(origin).origin === url.origin;
  if (sameOrigin) return false;
  if (url.pathname.endsWith(".data")) return true;
  return !RESOURCE_ROUTE_PATHS.some(path => matchPath(path, url.pathname));
}

/** A plain-text answer the Worker gives without React Router. */
function plainResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: withStaticPageHeaders({
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    }),
  });
}

/**
 * The Worker (workers/app.ts) for the server build `loadBuild` gives. The
 * build is loaded, and the React Router handler built from it, once per
 * isolate, on the first request (in development, the build is loaded again
 * for every request). Each request's environment is validated first (an
 * invalid one gets the static configuration error page) and handed to that
 * request's loaders and actions, with a fresh auth cache, through React
 * Router's context.
 *
 * Before React Router runs:
 * - A file under /assets/ that the static assets didn't have (a stale
 *   hashed URL) is a plain 404, never a rendered page.
 * - A cross-origin action on a page or `.data` URL gets the 400 React
 *   Router would give it, without its error report: a forged request is
 *   not an error of ours.
 *
 * entry.server puts the security headers on documents and single fetch
 * `.data` answers; everything else React Router answers (resource routes:
 * the auth redirects, the CSRF 403, the theme route's 303 and 405, the
 * proxies' JSON; and lazy route discovery's `/__manifest`) gets them here,
 * so every response carries them.
 */
export function createWorkerHandler(
  loadBuild: () => Promise<ServerBuild | ServerBuildModule>,
  mode: string
): WorkerFetch {
  // Given the build itself, React Router derives its route tree once; given
  // a function, it calls it and derives again on every request. Only the
  // dev server needs that, so an edited route is served.
  const createHandler = async (): Promise<RequestHandler> =>
    mode === "development"
      ? createRequestHandler(
          async () => (await loadBuild()) as ServerBuild,
          mode
        )
      : createRequestHandler((await loadBuild()) as ServerBuild, mode);
  let handler: Promise<RequestHandler> | undefined;
  const handleRequest = async (
    request: Request,
    context: RouterContextProvider
  ) => {
    // A failed load is not kept: the next request tries again.
    handler ??= createHandler().catch((error: unknown) => {
      handler = undefined;
      throw error;
    });
    return (await handler)(request, context);
  };

  return async (request, rawEnv) => {
    const parsed = parseEnv({
      ...(typeof rawEnv === "object" ? rawEnv : {}),
      ...__DEV_ENV_OVERRIDES__,
    });
    if (!parsed.ok) return configurationErrorResponse(parsed.problems);

    const url = new URL(request.url);
    if (url.pathname.startsWith("/assets/")) {
      return plainResponse(404, "Not Found");
    }
    if (isCrossOriginAction(request, url)) {
      return plainResponse(400, "Bad Request");
    }

    const context = new RouterContextProvider();
    context.set(appEnvContext, parsed.env);
    context.set(authCacheContext, {});

    const response = await handleRequest(request, context);
    if (response.headers.has("Content-Security-Policy")) return response;
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: withSecurityHeaders(response.headers, {
        env: parsed.env,
        nonce: createNonce(),
        development: false,
      }),
    });
  };
}
