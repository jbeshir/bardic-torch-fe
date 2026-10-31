import { createPagesFunctionHandler } from "@remix-run/cloudflare-pages";
import type { AppLoadContext } from "@remix-run/cloudflare";
import * as build from "server-build";
import type { Env } from "../worker-configuration";

export const onRequest = createPagesFunctionHandler<Env>({
  build,
  // A fresh auth cache per request lets all loaders in the request share one
  // auth result, preventing multiple refreshes with single-use tokens.
  getLoadContext: (context): AppLoadContext => ({
    cloudflare: { env: context.env },
    authCache: {},
  }),
});
