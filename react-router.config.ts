import type { Config } from "@react-router/dev/config";

/**
 * Server-rendered by the Worker (workers/app.ts). check:prod-build builds
 * into temporary directories.
 *
 * @public Loaded by `react-router build`, `react-router dev` and typegen.
 */
export default {
  ssr: true,
  buildDirectory: process.env.BT_BUILD_DIRECTORY ?? "build",
} satisfies Config;
