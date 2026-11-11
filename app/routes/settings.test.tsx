import { http, HttpResponse } from "msw";
import { Outlet } from "react-router";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { URLSearchParams as NodeURLSearchParams } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "~/components/ui/Toast";
import {
  loader as rootLoader,
  shouldRevalidate as rootRevalidate,
} from "~/root";
import { DISPLAY_NAME_RULE } from "~/schemas/rules";
import {
  API_BASE_URL,
  APP_ORIGIN,
  routeArgs,
  sessionCookie,
  sessionTokens,
} from "~/test/context";
import type { UpstreamErrorCode } from "~/schemas/api";
import { serveFixtureApi } from "~/test/msw";
import { renderRoutes } from "~/test/router";
import { action as meAction } from "./api.me";
import Settings, { clientAction, ErrorBoundary } from "./settings";

// The settings page in the browser (R25): the real root and settings
// loaders, the settings route's clientAction and the real /api proxy
// actions, run by a memory router, against the fixture API through msw.
// The browser's fetch to the app is stubbed: each request is re-made as a
// same-origin app request carrying the test's session cookie, and a
// Set-Cookie on the answer updates that cookie, as the browser would.
// `platform` can answer instead of the app (a 503 from Cloudflare, or no
// network at all).

const reportBoundary = vi.hoisted(() => vi.fn(() => "event-id"));
vi.mock("@sentry/react", () => ({
  isInitialized: () => false,
  captureException: reportBoundary,
}));

const fixtures = serveFixtureApi();
let cookie: string | undefined;
let platform: ((request: Request) => Promise<Response>) | undefined;

const PROXY_ACTIONS: ReadonlyArray<
  readonly [RegExp, Handler, (match: RegExpExecArray) => Params]
> = [[/^\/api\/me$/, meAction, () => ({})]];

beforeEach(async () => {
  // The router builds a Node `Request` from a `URLSearchParams` body, and
  // Node's Request only accepts its own URLSearchParams, not jsdom's.
  vi.stubGlobal("URLSearchParams", NodeURLSearchParams);
  cookie = await sessionCookie(
    sessionTokens({ accessToken: "fixture:contributor" })
  );
  platform = undefined;
  const upstreamFetch = globalThis.fetch;
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    const url = new URL(input, APP_ORIGIN);
    if (url.origin !== APP_ORIGIN) return upstreamFetch(input, init);
    const request = new Request(url, init);
    if (platform) return platform(request);
    for (const [pattern, action, params] of PROXY_ACTIONS) {
      const match = pattern.exec(url.pathname);
      if (match)
        return keepCookie(
          await run(action)({ request, params: params(match) })
        );
    }
    throw new Error(`No app route for ${url.pathname}`);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** What the browser's cookie jar does with the session's Set-Cookie. */
function keepCookie(response: Response): Response {
  const session = response.headers
    .getSetCookie()
    .find(value => value.startsWith("__Host-bt_session="));
  if (session) {
    const pair = session.split(";")[0] ?? "";
    cookie = pair.endsWith("=") ? undefined : pair;
  }
  return response;
}

async function asApp(request: Request): Promise<Request> {
  const url = new URL(request.url);
  const headers = new Headers({ Origin: APP_ORIGIN });
  const contentType = request.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);
  if (cookie) headers.set("Cookie", cookie);
  return new Request(`${APP_ORIGIN}${url.pathname}${url.search}`, {
    method: request.method,
    headers,
    ...(request.method === "GET" ? {} : { body: await request.text() }),
  });
}

type Params = Record<string, string | undefined>;
type Args = { request: Request; params: Params };
type Handler<Result = Response> = (
  args: ReturnType<typeof routeArgs>
) => Promise<Result>;

function run<Result>(handler: Handler<Result>) {
  return async ({ request, params }: Args) =>
    handler(routeArgs(await asApp(request), { params }));
}

function Loading() {
  return <p>Loading…</p>;
}

function renderSettings() {
  return renderRoutes(
    [
      {
        id: "root",
        path: "/",
        loader: run(rootLoader),
        shouldRevalidate: rootRevalidate,
        // The loaders run before the first render, as on a hydrating page.
        HydrateFallback: Loading,
        element: (
          <ToastProvider>
            <Outlet />
          </ToastProvider>
        ),
        children: [
          {
            id: "routes/settings",
            path: "settings",
            // What React Router runs for a route with a clientAction and no
            // server action.
            action: args =>
              clientAction({
                ...args,
                serverAction: () => {
                  throw new Error("/settings has no server action");
                },
              }),
            element: <Settings />,
            errorElement: <ErrorBoundary />,
          },
        ],
      },
    ],
    "/settings"
  );
}

/** The display name the API holds for the contributor. */
async function storedName() {
  const response = await fetch(`${API_BASE_URL}/v1/me`, {
    headers: { Authorization: "Bearer auth0|fixture:contributor" },
  });
  return ((await response.json()) as { display_name: string }).display_name;
}

/** The next save is answered with this error. */
function failNextSave(status: number, code: UpstreamErrorCode) {
  fixtures.server.use(
    http.patch(
      `${API_BASE_URL}/v1/me`,
      () => HttpResponse.json({ code, message: "failed" }, { status }),
      { once: true }
    )
  );
}

async function openPage() {
  const router = await renderSettings();
  await screen.findByRole("heading", { level: 1, name: "Settings" });
  return router;
}

const nameField = () => screen.getByRole("textbox", { name: "Display name" });
const notifications = () =>
  screen.getByRole("region", { name: "Notifications" });

describe("display name", () => {
  it("saves, shows the normalised name, says so in a toast and revalidates the root", async () => {
    const user = userEvent.setup();
    const router = await openPage();
    await user.clear(nameField());
    await user.type(nameField(), "  Wynn of the Long Road ");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await within(notifications()).findByText("Display name saved.")
    ).toBeInTheDocument();
    expect(nameField()).toHaveValue("Wynn of the Long Road");
    expect(nameField()).not.toHaveAttribute("aria-invalid");
    expect(await storedName()).toBe("Wynn of the Long Road");
    expect(router.state.loaderData.root).toMatchObject({
      account: {
        state: "signed-in",
        user: { display_name: "Wynn of the Long Road" },
      },
    });
  });

  it("a 400 from the API is an inline error with the rule, and focus goes back to the field", async () => {
    const user = userEvent.setup();
    await openPage();
    failNextSave(400, "invalid_request");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(nameField()).toHaveAccessibleDescription(
        expect.stringContaining(`Error: ${DISPLAY_NAME_RULE}`)
      )
    );
    expect(nameField()).toHaveFocus();
    expect(screen.queryByText(/We couldn’t save/)).toBeNull();
  });

  it("a session the API ended signs the whole page out, offering Log in back to settings", async () => {
    const user = userEvent.setup();
    const router = await openPage();
    failNextSave(401, "unauthenticated");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    // The proxy cleared the session and the root loader ran again, so the
    // shell (the account control) is signed out too, not only this form.
    expect(
      await screen.findByText("Log in to change your display name.")
    ).toBeInTheDocument();
    expect(cookie).toBeUndefined();
    expect(router.state.loaderData.root).toMatchObject({
      account: { state: "signed-out" },
    });
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/auth/login?returnTo=%2Fsettings"
    );
  });
});

describe("when the app can't be reached", () => {
  // SEC-2: a response the app didn't make (a platform 503) or no network
  // ends inline in the form, with the typed input kept; never in the
  // settings or root error boundary.
  const OFFLINE =
    "You seem to be offline. Your changes haven’t been saved yet.";
  const PLATFORM = {
    "a 503 from the platform": async () =>
      new Response("<!doctype html><title>Service unavailable</title>", {
        status: 503,
        headers: { "Content-Type": "text/html" },
      }),
    "a network failure": async () => {
      throw new TypeError("Failed to fetch");
    },
  } as const;
  const cases = Object.entries(PLATFORM).map(
    ([name, respond]) => [name, respond, name === "a network failure"] as const
  );

  function expectNoBoundary() {
    expect(
      screen.queryByRole("heading", { name: "We couldn’t load your settings" })
    ).toBeNull();
    expect(
      screen.getByRole("heading", { level: 1, name: "Settings" })
    ).toBeInTheDocument();
  }

  async function expectOfflineToast(offline: boolean) {
    if (offline) {
      expect(
        await within(notifications()).findByText(OFFLINE)
      ).toBeInTheDocument();
    } else {
      expect(within(notifications()).queryByText(OFFLINE)).toBeNull();
    }
  }

  it.each(cases)(
    "saving the display name on %s keeps the typed name and says so inline",
    async (_case, respond, offline) => {
      const user = userEvent.setup();
      await openPage();
      await user.clear(nameField());
      await user.type(nameField(), "Wynn of the Long Road");
      platform = respond;
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      const alert = await screen.findByText(
        "We couldn’t save your changes. Check your connection and try again."
      );
      expect(alert.closest('[role="alert"]')).not.toBeNull();
      expect(nameField()).toHaveValue("Wynn of the Long Road");
      expect(nameField()).not.toHaveAttribute("aria-invalid");
      expectNoBoundary();
      await expectOfflineToast(offline);
      expect(await storedName()).toBe("Morwen of the Marches");

      // Once the app answers again, the same form saves.
      platform = undefined;
      await user.click(screen.getByRole("button", { name: "Save changes" }));
      expect(
        await within(notifications()).findByText("Display name saved.")
      ).toBeInTheDocument();
      expect(await storedName()).toBe("Wynn of the Long Road");
    }
  );
});

describe("a form posted to the settings page without JS", () => {
  it("says changing settings needs JavaScript and nothing changed, and reports nothing", async () => {
    reportBoundary.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await renderRoutes(
      [
        {
          path: "/settings",
          loader: () => {
            // What React Router throws for a POST to a route with no action.
            throw new Response(null, {
              status: 405,
              statusText: "Method Not Allowed",
            });
          },
          HydrateFallback: Loading,
          element: null,
          errorElement: <ErrorBoundary />,
        },
      ],
      "/settings"
    );
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Changing your settings needs JavaScript",
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/^Nothing was changed\./)).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Back to settings" })
    ).toHaveAttribute("href", "/settings");
    expect(screen.queryByText(/couldn’t load your settings/)).toBeNull();
    expect(reportBoundary).not.toHaveBeenCalled();
  });
});
