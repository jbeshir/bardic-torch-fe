import { createBrowserRouter, Link, Outlet, useRouteError } from "react-router";
import { RouterProvider } from "react-router/dom";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SENTRY_DATA_COLLECTION } from "~/constants/sentry";
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

vi.mock("@sentry/react", () => ({
  isInitialized: () => sentry.initialised,
  init: (options: unknown) => {
    sentry.calls.push("init");
    sentry.options.push(options);
    sentry.initialised = true;
  },
  browserTracingIntegration: () => ({ name: "BrowserTracing" }),
  captureException: () => {
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

/** Every item of every envelope a real browser SDK sent, as JSON text. */
type Sent = { readonly items: string[] };

/**
 * The real browser SDK, started with the options initSentry chose (plus
 * `integrations`), sending to a recording transport.
 */
async function realSentry(integrations: (real: RealSentry) => unknown[]) {
  initSentry(DSN);
  const real = await vi.importActual<RealSentry>("@sentry/react");
  const sent: Sent = { items: [] };
  real.init({
    ...(sentry.options[0] as Parameters<RealSentry["init"]>[0]),
    tracesSampleRate: 1,
    integrations: integrations(real) as never[],
    transport: () => ({
      send: async envelope => {
        sent.items.push(JSON.stringify(envelope));
        return {};
      },
      flush: async () => true,
    }),
  });
  return { real, sent };
}
type RealSentry = typeof import("@sentry/react");
/** A streamed span, as the browser SDK sends it (span envelope v2). */
type SentSpan = {
  readonly is_segment: boolean;
  readonly attributes: Readonly<
    Record<string, { readonly value: unknown; readonly type: string }>
  >;
};

describe("the browser SDK's data", () => {
  afterEach(async () => {
    const real = await vi.importActual<RealSentry>("@sentry/react");
    await real.close();
    document.cookie = "reader=; max-age=0";
    window.history.replaceState(null, "", "/");
  });

  it("collects nothing about the reader: no cookies, headers, body, query string or IP address", async () => {
    window.history.replaceState(null, "", "/auth/callback?code=secret");
    document.cookie = "reader=cookie-secret";
    const { real, sent } = await realSentry(real =>
      real.getDefaultIntegrations({})
    );
    expect(sentry.options[0]).toMatchObject({
      dataCollection: SENTRY_DATA_COLLECTION,
    });
    real.captureException(new Error("boom"));
    await real.flush(2000);

    expect(sent.items).toHaveLength(1);
    const [, [[, event]]] = JSON.parse(sent.items[0] ?? "") as [
      unknown,
      [[unknown, Record<string, unknown>]],
    ];
    expect(event.request).toEqual({
      url: "http://localhost:3000/auth/callback",
    });
    expect(event.user).toBeUndefined();
    expect(sent.items.join("")).not.toMatch(
      /secret|ip_address|Cookie|User-Agent/i
    );
  });

  // Navigations as a reader makes them: by clicking a link. Sentry treats a
  // navigation with no click or keypress in the last 1.5 s, made within
  // 1.5 s of the active span starting, as a redirect. Before this test
  // clicked, that made the outcome depend on timing (flaky under load). The
  // click makes each navigation its own segment. The next navigation ends
  // the previous segment synchronously ("maybeEndActiveSpan" in
  // browserTracingIntegration). So the /help segment has ended, and is in
  // the span buffer, before `flush` sends the buffer. No idle timeout is
  // involved.
  it("traces navigations by URL path, without the query string", async () => {
    const { real, sent } = await realSentry(real => [
      real.browserTracingIntegration(),
    ]);
    const router = createBrowserRouter([
      {
        path: "/",
        element: <Outlet />,
        children: [
          {
            index: true,
            element: <Link to="/help/some-slug?code=secret">Help</Link>,
          },
          { path: "help/:slug", element: <Link to="/">Home</Link> },
        ],
      },
    ]);
    await act(async () => {
      render(<RouterProvider router={router} />);
    });
    await act(() =>
      userEvent.click(screen.getByRole("link", { name: "Help" }))
    );
    await screen.findByRole("link", { name: "Home" });
    await act(() =>
      userEvent.click(screen.getByRole("link", { name: "Home" }))
    );
    await screen.findByRole("link", { name: "Help" });
    await real.flush(2000);

    const spans = sent.items.flatMap(item => {
      const [, envelopeItems] = JSON.parse(item) as [
        unknown,
        [unknown, { items?: SentSpan[] }][],
      ];
      return envelopeItems.flatMap(([, payload]) => payload.items ?? []);
    });
    const help = spans.filter(
      span => span.attributes["url.path"]?.value === "/help/some-slug"
    );
    expect(help).toEqual([
      expect.objectContaining({
        is_segment: true,
        attributes: expect.objectContaining({
          "sentry.op": { value: "navigation", type: "string" },
          "url.full": {
            value: "http://localhost:3000/help/some-slug",
            type: "string",
          },
        }),
      }),
    ]);
    expect(sent.items.join("")).not.toContain("secret");
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
