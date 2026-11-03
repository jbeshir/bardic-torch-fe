import { cloudflare } from "@cloudflare/vite-plugin";
import mdx from "@mdx-js/rollup";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
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
  // esbuild, not Vite 8's default Lightning CSS, minifies the CSS:
  // Lightning rewrites more (colours to hex, `light-dark()` helpers, merged
  // rules), while esbuild keeps every declaration as the stylesheets write
  // it but for shorthands such as `inset`. It is a direct dev dependency
  // (Vite's is an optional peer) because of this option.
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
      // a binding; builds keep the list, so a deploy without
      // the secrets fails.
      ...(command === "serve"
        ? {
            config: config => {
              delete config.secrets;
            },
          }
        : {}),
    }),
    // Tailwind's own Lightning CSS pass is off for the same reason: it
    // rewrites the shadow tokens' colours as 8-bit hex, so an alpha of 0.06
    // becomes 15/255, which can paint a shadow pixel one step off. esbuild
    // (above) minifies and prefixes the CSS instead.
    tailwindcss({ optimize: false }),
    reactRouter(),
  ],
}));
