import { cloudflare } from "@cloudflare/vite-plugin";
import mdx from "@mdx-js/rollup";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import { MARKDOWN_OPTIONS } from "./app/content/markdown/options";
import { ENV_NAMES } from "./app/server/env.server";

// Under `react-router dev`, variables set in the process environment
// override .dev.vars, so `npm run dev:fixtures` can point the app at the
// fixture API. The Worker lays them over its bindings
// (`__DEV_ENV_OVERRIDES__`, app/server/worker.server.ts).
function devEnvOverrides(): Record<string, string> {
  return Object.fromEntries(
    ENV_NAMES.flatMap(name => {
      const value = process.env[name];
      return value === undefined ? [] : [[name, value]];
    })
  );
}

// Build modes: production | preview | e2e | development (scripts/build.mjs,
// scripts/dev.mjs). Which routes a mode has is in app/routes.ts.
/** @public Loaded by `react-router build` and `react-router dev`. */
export default defineConfig(({ command, mode }) => ({
  // Tests (vitest.config.ts) stub both per case instead.
  define: {
    __STUB_AUTH__: JSON.stringify(mode === "e2e" || mode === "development"),
    // Builds get none: a deployed or e2e Worker reads only its bindings.
    __DEV_ENV_OVERRIDES__: JSON.stringify(
      command === "serve" ? devEnvOverrides() : {}
    ),
  },
  resolve: { tsconfigPaths: true },
  // The CSS minifier FE1 had. Vite 8's default, Lightning CSS, rewrites
  // more (colours to hex, `light-dark()` helpers, merged rules); esbuild's
  // output is FE1's but for shorthands such as `inset`, so the pages paint
  // the same. esbuild comes with wrangler and tsx.
  build: { cssMinify: "esbuild" },
  plugins: [
    // Help pages are Markdown, compiled before React Router sees the route
    // modules.
    { enforce: "pre", ...mdx(MARKDOWN_OPTIONS) },
    cloudflare({
      viteEnvironment: { name: "ssr" },
      // wrangler.jsonc's `secrets.required` makes the dev server load only
      // the required secrets (and `vars`) from .dev.vars, which would drop
      // the optional SENTRY_DSN and AUTH_MODE. In dev every .dev.vars key is
      // a binding, as before; builds keep the list, so a deploy without
      // the secrets fails.
      ...(command === "serve"
        ? {
            config: config => {
              delete config.secrets;
            },
          }
        : {}),
    }),
    reactRouter(),
  ],
}));
