/// <reference types="vitest/config" />
import {
  vitePlugin as remix,
  cloudflareDevProxyVitePlugin as remixCloudflareDevProxy,
} from "@remix-run/dev";
import type { AppLoadContext } from "@remix-run/cloudflare";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const isTest = process.env.VITEST === "true";

// Build modes: production | preview | e2e | development.
export default defineConfig(({ mode }) => ({
  define: {
    __STUB_AUTH__: JSON.stringify(mode === "e2e" || mode === "development"),
  },
  plugins: [
    ...(!isTest
      ? [
          remixCloudflareDevProxy({
            getLoadContext: ({ context }) =>
              ({
                ...context,
                authCache: {},
              }) as unknown as AppLoadContext,
          }),
          remix({
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
    globals: true,
    environment: "jsdom",
    setupFiles: ["./app/test/setup.ts"],
    include: [
      "app/**/*.{test,spec}.{ts,tsx}",
      "test/**/*.{test,spec}.{ts,tsx}",
      "scripts/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: ["node_modules", "build*"],
  },
}));
