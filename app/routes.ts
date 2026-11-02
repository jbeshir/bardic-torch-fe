import { flatRoutes } from "@remix-run/fs-routes";
import type { RouteConfig } from "@remix-run/route-config";

/**
 * The routes are app/routes, by Remix's flat file convention. Co-located
 * tests are never routes; the styleguide is left out of production builds
 * only. Remix evaluates this file with the build's Vite mode (production,
 * preview, e2e or development).
 *
 * @public Loaded by Remix's Vite plugin (the `v3_routeConfig` future flag).
 */
export default flatRoutes({
  ignoredRouteFiles: [
    "**/*.test.{ts,tsx}",
    ...(import.meta.env.MODE === "production" ? ["**/styleguide*"] : []),
  ],
}) satisfies RouteConfig;
