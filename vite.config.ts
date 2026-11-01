/// <reference types="vitest/config" />
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

const isTest = process.env.VITEST === "true";

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
export default defineConfig(({ mode }) => ({
  // Tests stub `__STUB_AUTH__` per case, so it is only defined for builds.
  define: isTest
    ? {}
    : {
        __STUB_AUTH__: JSON.stringify(mode === "e2e" || mode === "development"),
      },
  plugins: [
    // Help pages are Markdown, compiled before Remix sees the route modules.
    { enforce: "pre", ...mdx(MARKDOWN_OPTIONS) },
    ...(!isTest
      ? [
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
            // Co-located tests are never routes; the styleguide is left out
            // of production builds only.
            ignoredRouteFiles: [
              "**/*.test.{ts,tsx}",
              ...(mode === "production" ? ["**/styleguide*"] : []),
            ],
            future: {
              v3_fetcherPersist: true,
              v3_relativeSplatPath: true,
              v3_throwAbortReason: true,
            },
          }),
        ]
      : []),
    tsconfigPaths(),
  ],
  test: {
    // Workers resolve react-dom's `worker` build, which (unlike the Node
    // build) has the renderToReadableStream that entry.server uses.
    alias: { "react-dom/server": "react-dom/server.browser" },
    globals: true,
    // Component tests (*.test.tsx) need a DOM; everything else runs in node,
    // like the Workers runtime it targets.
    environment: "node",
    environmentMatchGlobs: [["**/*.test.tsx", "jsdom"]],
    setupFiles: ["./app/test/setup.ts"],
    include: [
      "app/**/*.{test,spec}.{ts,tsx}",
      "test/**/*.{test,spec}.{ts,tsx}",
      "scripts/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: ["node_modules", "build*"],
  },
}));
