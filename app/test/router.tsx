import { UNSAFE_RemixContext } from "@remix-run/react";
import { act, render } from "@testing-library/react";
import type { ComponentProps, ReactElement } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

type RemixContextValue = NonNullable<
  ComponentProps<typeof UNSAFE_RemixContext.Provider>["value"]
>;

/**
 * Just enough of Remix's context for `<Link prefetch="intent">`: once a link
 * has had focus or hover for 100 ms it renders prefetch `<link>`s, which read
 * the route manifest. One route, no loader, nothing to fetch.
 */
const REMIX_CONTEXT: RemixContextValue = {
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
        hasErrorBoundary: false,
      },
    },
    entry: { module: "/entry.client.js", imports: [] },
    url: "/manifest.js",
    version: "test",
  },
  routeModules: { root: { default: () => null } },
  future: {
    v3_fetcherPersist: true,
    v3_relativeSplatPath: true,
    v3_lazyRouteDiscovery: false,
    v3_singleFetch: false,
  },
  isSpaMode: false,
};

/**
 * Renders `ui` as the page at `url` under a memory router and Remix's
 * context, so components using Remix `Link`, `useLocation` or
 * `useRevalidator` work. Returns the router, e.g. to read the location
 * after a click.
 */
export async function renderWithRouter(ui: ReactElement, url = "/") {
  const router = createMemoryRouter([{ id: "root", path: "*", element: ui }], {
    initialEntries: [url],
  });
  await act(async () => {
    render(
      <UNSAFE_RemixContext.Provider value={REMIX_CONTEXT}>
        <RouterProvider router={router} />
      </UNSAFE_RemixContext.Provider>
    );
  });
  return router;
}
