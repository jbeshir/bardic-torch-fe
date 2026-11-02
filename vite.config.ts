import {
  vitePlugin as remix,
  cloudflareDevProxyVitePlugin as remixCloudflareDevProxy,
} from "@remix-run/dev";
import mdx from "@mdx-js/rollup";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { MARKDOWN_OPTIONS } from "./app/content/markdown/options";
import { ENV_NAMES, parseEnv } from "./app/server/env.server";
import type { Env } from "./worker-configuration";

// In `remix vite:dev`, variables set in the process environment override
// .dev.vars, so `npm run dev:fixtures` can point the app at the fixture API.
function devEnvOverrides(): Record<string, string> {
  return Object.fromEntries(
    ENV_NAMES.flatMap(name => {
      const value = process.env[name];
      return value === undefined ? [] : [[name, value]];
    })
  );
}

// Build modes: production | preview | e2e | development.
/** @public Loaded by `remix vite:build` and `remix vite:dev`. */
export default defineConfig(({ mode }) => ({
  // Tests (vitest.config.ts) stub `__STUB_AUTH__` per case instead.
  define: {
    __STUB_AUTH__: JSON.stringify(mode === "e2e" || mode === "development"),
  },
  // `remix vite:dev` loads dependencies in Node, with the Workers conditions
  // that remixCloudflareDevProxy sets. Vite 5 always added `node` to them;
  // Vite 6 only has it as the default the plugin's list replaces, and without
  // it a Node-only package such as @sentry/remix's server build is inlined as
  // ESM and fails. Builds bundle everything, so this only affects dev.
  ssr: { resolve: { externalConditions: ["node"] } },
  plugins: [
    // Help pages are Markdown, compiled before Remix sees the route modules.
    { enforce: "pre", ...mdx(MARKDOWN_OPTIONS) },
    remixCloudflareDevProxy<Env, IncomingRequestCfProperties>({
      getLoadContext: ({ context }) => {
        const parsed = parseEnv({
          ...context.cloudflare.env,
          ...devEnvOverrides(),
        });
        if (!parsed.ok) {
          throw new Error(
            `Invalid environment:\n${parsed.problems.join("\n")}`
          );
        }
        return { cloudflare: { env: parsed.env }, authCache: {} };
      },
    }),
    remix({
      // check:prod-build builds into temporary directories.
      buildDirectory: process.env.REMIX_BUILD_DIRECTORY ?? "build",
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_lazyRouteDiscovery: true,
        v3_singleFetch: true,
        // The routes, and which files are not routes, are in app/routes.ts.
        v3_routeConfig: true,
      },
    }),
    tsconfigPaths(),
  ],
}));
