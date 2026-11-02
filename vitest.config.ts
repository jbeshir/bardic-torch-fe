import mdx from "@mdx-js/rollup";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";
import { MARKDOWN_OPTIONS } from "./app/content/markdown/options";

// Vitest has its own config, so it never loads the Remix or Cloudflare
// plugins from vite.config.ts: only Vite core, the Markdown compiler (help
// pages) and the `~/` path alias.
export default defineConfig({
  plugins: [{ enforce: "pre", ...mdx(MARKDOWN_OPTIONS) }, tsconfigPaths()],
  resolve: {
    // Workers resolve react-dom's `worker` build, which (unlike the Node
    // build) has the renderToReadableStream that entry.server uses.
    alias: { "react-dom/server": "react-dom/server.browser" },
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
