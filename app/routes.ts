import type { RouteConfig } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

/**
 * Whether each build mode has the styleguide: development, preview and e2e
 * builds do, production doesn't.
 */
const STYLEGUIDE_BY_MODE = {
  production: false,
  preview: true,
  e2e: true,
  development: true,
} as const;

/**
 * The build mode is explicit (scripts/build.mjs, scripts/dev.mjs and
 * scripts/dev-fixtures.mjs set BT_BUILD_MODE), never NODE_ENV, which a shell
 * could export by accident. It fails safe: unset (a bare `react-router
 * build`) is production, and an unknown value is an error.
 */
function includesStyleguide(mode: string): boolean {
  if (!Object.hasOwn(STYLEGUIDE_BY_MODE, mode)) {
    throw new Error(
      `Unknown BT_BUILD_MODE "${mode}": use production, preview, e2e or development`
    );
  }
  return STYLEGUIDE_BY_MODE[mode as keyof typeof STYLEGUIDE_BY_MODE];
}

/**
 * The routes are app/routes, by React Router's flat file convention.
 * Co-located tests are never routes; the styleguide is left out of
 * production builds only.
 *
 * @public Loaded by React Router's Vite plugin and typegen.
 */
export default flatRoutes({
  ignoredRouteFiles: [
    "**/*.test.{ts,tsx}",
    ...(includesStyleguide(process.env.BT_BUILD_MODE ?? "production")
      ? []
      : ["**/styleguide*"]),
  ],
}) satisfies RouteConfig;
