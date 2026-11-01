import { Link, Outlet, useRouteError } from "@remix-run/react";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useErrorReference } from "~/hooks/useErrorReference";
import { renderRoutes } from "~/test/router";
import { initSentry, SentryProvider } from "./SentryContext";

// R28: Sentry is optional. Without a DSN nothing is initialised (so nothing
// can be sent); with one, the browser SDK starts exactly once, and an
// error page reports and shows the event id even when it is the first
// thing rendered.

const sentry = vi.hoisted(() => ({
  initialised: false,
  calls: [] as string[],
  options: [] as unknown[],
}));

vi.mock("@sentry/remix", () => ({
  isInitialized: () => sentry.initialised,
  init: (options: unknown) => {
    sentry.calls.push("init");
    sentry.options.push(options);
    sentry.initialised = true;
  },
  browserTracingIntegration: () => ({ name: "BrowserTracing" }),
  captureRemixErrorBoundaryError: () => {
    sentry.calls.push("capture");
    return "5e1f00d2a4b94c7e";
  },
}));

afterEach(() => {
  sentry.initialised = false;
  sentry.calls.length = 0;
  sentry.options.length = 0;
  vi.restoreAllMocks();
});

const DSN = "https://public@o1.ingest.sentry.io/42";

/** Root (with the DSN from its loader) → two pages, one that fails. */
function renderApp(dsn: string | undefined, url = "/one") {
  function Failure() {
    const reference = useErrorReference(useRouteError(), true);
    return <p>Reference: {reference ?? "none"}</p>;
  }
  return renderRoutes(
    [
      {
        id: "root",
        path: "/",
        loader: () => ({ sentryDsn: dsn }),
        element: (
          <SentryProvider dsn={dsn}>
            <Link to="/one">One</Link> <Link to="/two">Two</Link>
            <Outlet />
          </SentryProvider>
        ),
        children: [
          { path: "one", element: <h1>One</h1> },
          { path: "two", element: <h1>Two</h1> },
          {
            path: "broken",
            loader: () => {
              throw new Error("The page broke");
            },
            element: null,
            errorElement: <Failure />,
          },
        ],
      },
    ],
    url
  );
}

describe("initSentry", () => {
  it("does nothing without a DSN", () => {
    initSentry(undefined);
    initSentry("");
    expect(sentry.calls).toEqual([]);
  });

  it("starts the SDK with the DSN once", () => {
    initSentry(DSN);
    initSentry(DSN);
    expect(sentry.calls).toEqual(["init"]);
    expect(sentry.options[0]).toMatchObject({ dsn: DSN });
  });
});

describe("SentryProvider", () => {
  it("initialises nothing without a DSN, across navigations", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    await renderApp(undefined);
    await act(() => userEvent.click(screen.getByRole("link", { name: "Two" })));
    expect(await screen.findByRole("heading", { name: "Two" })).toBeVisible();
    expect(sentry.calls).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("initialises once with a DSN, with navigation tracing, across re-renders and navigations", async () => {
    await renderApp(DSN);
    await act(() => userEvent.click(screen.getByRole("link", { name: "Two" })));
    await screen.findByRole("heading", { name: "Two" });
    await act(() => userEvent.click(screen.getByRole("link", { name: "One" })));
    await screen.findByRole("heading", { name: "One" });

    expect(sentry.calls).toEqual(["init"]);
    expect(sentry.options[0]).toMatchObject({
      dsn: DSN,
      integrations: [{ name: "BrowserTracing" }],
    });
  });
});

describe("useErrorReference", () => {
  it("on a page that fails on its first render, starts Sentry before reporting and shows the event id", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await renderApp(DSN, "/broken");
    expect(
      await screen.findByText("Reference: 5e1f00d2a4b94c7e")
    ).toBeVisible();
    expect(sentry.calls.slice(0, 2)).toEqual(["init", "capture"]);
  });

  it("without a DSN reports nowhere and shows no reference", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await renderApp(undefined, "/broken");
    expect(await screen.findByText("Reference: none")).toBeVisible();
    expect(sentry.calls).toEqual(["capture"]);
  });
});
