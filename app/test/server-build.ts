import { createRequestHandler, type ServerBuild } from "@remix-run/cloudflare";
import * as entryServer from "~/entry.server";
import * as rootModule from "~/root";
import { loadContext } from "./context";

type RouteModule = ServerBuild["routes"][string]["module"];

/** A route of the test build, under root. */
type TestRoute = {
  readonly id: string;
  readonly module: RouteModule;
  readonly hasLoader: boolean;
} & ({ readonly path: string } | { readonly index: true });

function manifestEntry(
  route: { id: string; parentId?: string; hasLoader: boolean } & (
    | { path: string }
    | { index: true }
  )
) {
  return {
    ...route,
    module: `/assets/${route.id}.js`,
    imports: [],
    hasAction: false,
    hasClientAction: false,
    hasClientLoader: false,
    hasErrorBoundary: route.id === "root",
  };
}

/**
 * A server build made of the real entry module and root plus `routes`,
 * served the way the Pages function serves it. `get` requests a path with
 * an optional Cookie header.
 */
export function serveApp(routes: readonly TestRoute[]) {
  const build: ServerBuild = {
    mode: "production",
    entry: { module: entryServer },
    routes: {
      root: { id: "root", path: "", module: rootModule },
      ...Object.fromEntries(
        routes.map(route => [
          route.id,
          {
            id: route.id,
            parentId: "root",
            module: route.module,
            ...("index" in route ? { index: true } : { path: route.path }),
          },
        ])
      ),
    },
    assets: {
      entry: { module: "/assets/entry.client.js", imports: [] },
      routes: {
        root: manifestEntry({ id: "root", path: "", hasLoader: true }),
        ...Object.fromEntries(
          routes.map(route => [
            route.id,
            manifestEntry({
              id: route.id,
              parentId: "root",
              hasLoader: route.hasLoader,
              ...("index" in route
                ? { index: true as const }
                : { path: route.path }),
            }),
          ])
        ),
      },
      url: "/assets/manifest.js",
      version: "test",
    },
    publicPath: "/",
    assetsBuildDirectory: "build/client",
    future: {
      v3_fetcherPersist: true,
      v3_relativeSplatPath: true,
      v3_throwAbortReason: true,
      v3_singleFetch: false,
      v3_lazyRouteDiscovery: false,
    },
    isSpaMode: false,
  };
  const handler = createRequestHandler(build, "production");

  return function get(path: string, cookie?: string) {
    return handler(
      new Request(`https://app.test${path}`, {
        headers: {
          "User-Agent": "test",
          ...(cookie ? { Cookie: cookie } : {}),
        },
      }),
      loadContext()
    );
  };
}
