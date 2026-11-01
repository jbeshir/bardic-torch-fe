import type { ServerBuild } from "@remix-run/cloudflare";
import { createPagesFunctionHandler } from "@remix-run/cloudflare-pages";
import type { Env } from "../../worker-configuration";
import {
  configurationErrorResponse,
  parseEnv,
  type AppEnv,
} from "./env.server";
import { createNonce, withSecurityHeaders } from "./security-headers.server";

/**
 * The Pages Function (functions/[[path]].ts) for `build`. The Remix handler
 * is built once per isolate; each request's environment is validated
 * first (an invalid one gets the static configuration error page) and
 * handed to that request's loaders.
 *
 * entry.server puts the security headers on documents and `?_data`
 * answers; everything else Remix answers (resource routes: the auth
 * redirects, the CSRF 403, the theme route's 303 and 405, the proxies'
 * JSON) gets them here, so every response carries them.
 */
export function createPagesHandler(build: ServerBuild): PagesFunction<Env> {
  /** Each request's validated environment, for its getLoadContext. */
  const envOf = new WeakMap<Request, AppEnv>();
  const handleRequest = createPagesFunctionHandler<Env>({
    build,
    // A fresh auth cache per request lets all loaders in the request share
    // one auth result, preventing multiple refreshes with single-use tokens.
    getLoadContext: ({ request }) => {
      const env = envOf.get(request);
      if (!env) throw new Error("The request’s environment wasn’t validated");
      return { cloudflare: { env }, authCache: {} };
    },
  });

  return async context => {
    const parsed = parseEnv(context.env);
    if (!parsed.ok) return configurationErrorResponse(parsed.problems);
    envOf.set(context.request, parsed.env);

    const response = await handleRequest(context);
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
