import { createPagesFunctionHandler } from "@remix-run/cloudflare-pages";
import * as build from "server-build";
import type { Env } from "../worker-configuration";
import { configurationErrorResponse, parseEnv } from "../app/server/env.server";

export const onRequest: PagesFunction<Env> = context => {
  const parsed = parseEnv(context.env);
  if (!parsed.ok) return configurationErrorResponse(parsed.problems);

  const handleRequest = createPagesFunctionHandler<Env>({
    build,
    // A fresh auth cache per request lets all loaders in the request share one
    // auth result, preventing multiple refreshes with single-use tokens.
    getLoadContext: () => ({
      cloudflare: { env: parsed.env },
      authCache: {},
    }),
  });
  return handleRequest(context);
};
