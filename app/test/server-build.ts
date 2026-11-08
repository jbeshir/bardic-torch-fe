import { createRequestHandler, type ServerBuild } from "react-router";
import * as entryServer from "~/entry.server";
import * as rootModule from "~/root";
import { loadContext } from "./context";

type RouteModule = NonNullable<ServerBuild["routes"][string]>["module"];

/**
 * A route module as the server sees it: resource routes (actions and
 * loaders only) have no `default`, though ServerRouteModule's type requires
 * one.
 */
type TestRouteModule = Omit<RouteModule, "default"> &
  Partial<Pick<RouteModule, "default">>;

/** A route of the test build, under root or under `parentId`. */
type TestRoute = {
  readonly id: string;
  /** The layout route it renders in; root when undefined. */
  readonly parentId?: string;
  readonly module: TestRouteModule;
  readonly hasLoader: boolean;
  /** The route renders its own ErrorBoundary (the root always does). */
  readonly hasErrorBoundary?: boolean;
} & ({ readonly path: string } | { readonly index: true });

function manifestEntry({
  hasErrorBoundary = false,
  ...route
}: {
  readonly id: string;
  readonly parentId?: string;
  readonly hasLoader: boolean;
  readonly hasErrorBoundary?: boolean;
} & ({ readonly path: string } | { readonly index: true })) {
  return {
    ...route,
    module: `/assets/${route.id}.js`,
    imports: [],
    hasAction: false,
    hasClientAction: false,
    hasClientLoader: false,
    hasClientMiddleware: false,
    hasErrorBoundary: route.id === "root" || hasErrorBoundary,
    clientActionModule: undefined,
    clientLoaderModule: undefined,
    clientMiddlewareModule: undefined,
    hydrateFallbackModule: undefined,
  };
}

/** A server build made of the real entry module and root plus `routes`. */
export function testBuild(routes: readonly TestRoute[]): ServerBuild {
  return {
    entry: { module: entryServer },
    routes: {
      root: { id: "root", path: "", module: rootModule },
      ...Object.fromEntries(
        routes.map(route => [
          route.id,
          {
            id: route.id,
            parentId: route.parentId ?? "root",
            module: route.module as RouteModule,
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
              parentId: route.parentId ?? "root",
              hasLoader: route.hasLoader,
              hasErrorBoundary: route.hasErrorBoundary ?? false,
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
    future: {},
    ssr: true,
    isSpaMode: false,
    prerender: [],
    routeDiscovery: { mode: "lazy", manifestPath: "/__manifest" },
  };
}

/**
 * `testBuild(routes)` served the way the Worker serves it. `get` requests a
 * path with an optional Cookie header.
 */
export function serveApp(routes: readonly TestRoute[]) {
  const handler = createRequestHandler(testBuild(routes), "production");

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
