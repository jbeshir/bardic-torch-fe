import { act, render } from "@testing-library/react";
import type { ComponentProps, ReactElement } from "react";
import { renderToString } from "react-dom/server";
import {
  createMemoryRouter,
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
  UNSAFE_FrameworkContext,
} from "react-router";
import { RouterProvider } from "react-router/dom";
import { ThemeChoiceProvider } from "~/contexts/ThemeChoiceContext";

type FrameworkContextValue = NonNullable<
  ComponentProps<typeof UNSAFE_FrameworkContext.Provider>["value"]
>;

/**
 * Just enough of React Router's framework context for `<Link
 * prefetch="intent">`: once a link has had focus or hover for 100 ms it
 * renders prefetch `<link>`s, which read the route manifest. One route, no
 * loader, nothing to fetch.
 */
const FRAMEWORK_CONTEXT: FrameworkContextValue = {
  manifest: {
    routes: {
      root: {
        id: "root",
        path: "*",
        module: "/root.js",
        hasAction: false,
        hasLoader: false,
        hasClientAction: false,
        hasClientLoader: false,
        hasClientMiddleware: false,
        hasErrorBoundary: false,
        clientActionModule: undefined,
        clientLoaderModule: undefined,
        clientMiddlewareModule: undefined,
        hydrateFallbackModule: undefined,
      },
    },
    entry: { module: "/entry.client.js", imports: [] },
    url: "/manifest.js",
    version: "test",
  },
  routeModules: { root: { default: () => null } },
  future: {},
  ssr: true,
  isSpaMode: false,
  routeDiscovery: { mode: "lazy", manifestPath: "/__manifest" },
};

/**
 * Renders `ui` as the page at `url` under a memory router and React
 * Router's framework context, so components using `Link`, `useLocation` or
 * `useRevalidator` work, inside the theme choice the root layout provides
 * (following the device). Returns the router, e.g. to read the location
 * after a click.
 */
export async function renderWithRouter(ui: ReactElement, url = "/") {
  return renderRoutes([{ id: "root", path: "*", element: ui }], url);
}

/** Like renderWithRouter, for a route tree of your own (loaders, errors). */
export async function renderRoutes(
  routes: Parameters<typeof createMemoryRouter>[0],
  url = "/"
) {
  const router = createMemoryRouter(routes, { initialEntries: [url] });
  await act(async () => {
    render(
      <UNSAFE_FrameworkContext value={FRAMEWORK_CONTEXT}>
        <ThemeChoiceProvider loaded="system">
          <RouterProvider router={router} />
        </ThemeChoiceProvider>
      </UNSAFE_FrameworkContext>
    );
  });
  return router;
}

/**
 * The server render of `element` as the page at `url`: what a reader
 * without JS gets, and what the page shows before hydration.
 */
export async function renderOnServer(element: ReactElement, url = "/") {
  const routes = [{ path: "*", element }];
  const handler = createStaticHandler(routes);
  const context = await handler.query(new Request(`http://localhost${url}`));
  if (context instanceof Response) throw new Error("unexpected redirect");
  const router = createStaticRouter(routes, context);
  return renderToString(
    <StaticRouterProvider router={router} context={context} hydrate={false} />
  );
}
