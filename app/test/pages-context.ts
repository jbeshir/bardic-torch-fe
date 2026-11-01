import type { Env } from "../../worker-configuration";

type PagesHandler = PagesFunction<Env>;

/**
 * Call a Pages Function `onRequest` the way Cloudflare does, with `env` as
 * its bindings. No static file matches, so every request reaches Remix.
 */
export function callPagesFunction(
  onRequest: PagesHandler,
  request: Request,
  env: Readonly<Record<string, unknown>>
) {
  const context = {
    request,
    env: {
      ...env,
      ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
    },
    data: {},
    params: {},
    functionPath: "/[[path]]",
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
    next: async () => new Response(null, { status: 404 }),
  };
  return onRequest(context as unknown as Parameters<PagesHandler>[0]);
}
