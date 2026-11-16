import type { RouteConfig } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

/**
 * The routes are app/routes, by React Router's flat file convention.
 * Co-located tests are never routes.
 *
 * @public Loaded by React Router's Vite plugin and typegen.
 */
export default flatRoutes({
  ignoredRouteFiles: ["**/*.test.{ts,tsx}"],
}) satisfies RouteConfig;
