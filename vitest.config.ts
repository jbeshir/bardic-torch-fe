import mdx from "@mdx-js/rollup";
import { defineConfig } from "vitest/config";
import { MARKDOWN_OPTIONS } from "./app/content/markdown/options.ts";

// Vitest has its own config, so it never loads the React Router or
// Cloudflare plugins from vite.config.ts (no dev server, no workerd): only
// Vite core, the Markdown compiler (help pages) and the `~/` path alias.
export default defineConfig({
  plugins: [{ enforce: "pre", ...mdx(MARKDOWN_OPTIONS) }],
  resolve: {
    tsconfigPaths: true,
    alias: [
      // Workers resolve react-dom's `workerd` build, which (unlike the Node
      // build) has the renderToReadableStream that entry.server uses.
      { find: "react-dom/server", replacement: "react-dom/server.edge" },
      // The Worker entry imports the build React Router's plugin provides;
      // its tests mock this stub instead (test/worker-entry.test.ts).
      {
        find: "virtual:react-router/server-build",
        replacement: "/test/support/server-build-stub.ts",
      },
      // Vitest turns unprocessed CSS into "", and root.tsx would render
      // <link rel="stylesheet" href="">: this gives it a real URL.
      {
        find: /^~\/styles\/app\.css\?url$/,
        replacement: "/test/support/stylesheet-url.ts",
      },
    ],
  },
  test: {
    globals: true,
    setupFiles: ["./app/test/setup.ts"],
    exclude: ["node_modules", "build*"],
    // Component tests (*.test.tsx) need a DOM; everything else runs in node,
    // like the Workers runtime it targets.
    projects: [
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["{app,test,scripts}/**/*.{test,spec}.tsx"],
        },
      },
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["{app,test,scripts}/**/*.{test,spec}.ts"],
        },
      },
    ],
  },
});
