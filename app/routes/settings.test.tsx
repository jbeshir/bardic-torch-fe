import { Outlet } from "@remix-run/react";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { URLSearchParams as NodeURLSearchParams } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "~/components/ui/Toast";
import {
  loader as rootLoader,
  shouldRevalidate as rootRevalidate,
} from "~/root";
import {
  ACTIVE_TOKEN_LIMIT,
  DISPLAY_NAME_HINT,
  DISPLAY_NAME_RULE,
  TOKEN_NAME_RULE,
} from "~/schemas/rules";
import {
  APP_ORIGIN,
  loadContext,
  sessionCookie,
  sessionTokens,
} from "~/test/context";
import type { UpstreamErrorCode } from "~/schemas/api";
import { serveFixtureApi } from "~/test/msw";
import { renderRoutes } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { action as meAction } from "./api.me";
import { action as revokeAction } from "./api.tokens.$tokenId";
import { action as tokensAction } from "./api.tokens";
import Settings, {
  clientAction,
  ErrorBoundary,
  loader as settingsLoader,
  shouldRevalidate,
} from "./settings";

// The settings page in the browser (R25): the real root and settings
// loaders, the settings route's clientAction and the real /api proxy
// actions, run by a memory router, against the fixture API through msw.
// The browser's fetch to the app is stubbed: each request is re-made as a
// same-origin app request carrying the test's session cookie, and a
// Set-Cookie on the answer updates that cookie, as the browser would.
// `platform` can answer instead of the app (a 503 from Cloudflare, or no
// network at all).

vi.mock("@sentry/remix", () => ({
  isInitialized: () => false,
  captureRemixErrorBoundaryError: () => "event-id",
}));

const fixtures = serveFixtureApi();
let cookie: string | undefined;
let platform: ((request: Request) => Promise<Response>) | undefined;

const PROXY_ACTIONS: ReadonlyArray<
  readonly [RegExp, Handler, (match: RegExpExecArray) => Params]
> = [
  [/^\/api\/me$/, meAction, () => ({})],
  [/^\/api\/tokens$/, tokensAction, () => ({})],
  [
    /^\/api\/tokens\/([^/]+)$/,
    revokeAction,
    match => ({ tokenId: decodeURIComponent(match[1] ?? "") }),
  ],
];

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
type Handler = (args: {
  request: Request;
  params: Params;
  context: ReturnType<typeof loadContext>;
}) => Promise<Response>;

function run(handler: Handler) {
  return async ({ request, params }: Args) =>
    handler({ request: await asApp(request), params, context: loadContext() });
}

function renderSettings() {
  return renderRoutes(
    [
      {
        id: "root",
        path: "/",
        loader: run(rootLoader),
        shouldRevalidate: rootRevalidate,
        element: (
          <ToastProvider>
            <Outlet />
          </ToastProvider>
        ),
        children: [
          {
            id: "routes/settings",
            path: "settings",
            loader: run(settingsLoader),
            // What Remix runs for a route with a clientAction and no
            // server action.
            action: ({ request, params }) =>
              clientAction({
                request,
                params,
                serverAction: () => {
                  throw new Error("/settings has no server action");
                },
              }),
            shouldRevalidate,
            element: <Settings />,
            errorElement: <ErrorBoundary />,
          },
        ],
      },
    ],
    "/settings"
  );
}

function contributor() {
  const user = fixtures.state().users.get("contributor");
  if (!user) throw new Error("no seeded contributor");
  return user;
}

function fail(operationId: string, status: number, code: UpstreamErrorCode) {
  fixtures.state().failures.set(`contributor:${operationId}`, {
    status,
    code,
    remaining: 1,
  });
}

async function openPage() {
  const router = await renderSettings();
  await screen.findByRole("heading", { level: 1, name: "Settings" });
  return router;
}

const nameField = () => screen.getByRole("textbox", { name: "Display name" });
const tokenNameField = () =>
  screen.getByRole("textbox", { name: /Token name/ });
const tokenTable = () => screen.getByRole("table", { name: "Your API tokens" });
const notifications = () =>
  screen.getByRole("region", { name: "Notifications" });

describe("settings page", () => {
  it("shows the profile and the tokens, newest first, named by prefix when unnamed", async () => {
    await openPage();
    expect(nameField()).toHaveValue("Morwen of the Marches");
    expect(nameField()).toHaveAccessibleDescription(
      `Shown on your edits and in page history. Use your SCA name if you like. ${DISPLAY_NAME_HINT}`
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Profile" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "API tokens" })
    ).toBeInTheDocument();

    const rows = within(tokenTable()).getAllByRole("row").slice(1);
    expect(rows.map(row => row.textContent)).toEqual([
      "Songbook importer7d3b5a6f…1 Oct 2026NeverRevoke token Songbook importer",
      "Token 9c1e7d3b…9c1e7d3b…1 Sep 20262 Sep 2026Revoke token Token 9c1e7d3b…",
      "Laptop scripts4f2a9c1e…15 Aug 202620 Oct 2026Revoke token Laptop scripts",
    ]);
    expect(
      within(tokenTable()).getByRole("button", {
        name: "Revoke token Token 9c1e7d3b…",
      })
    ).toHaveAttribute("aria-haspopup", "dialog");
    expect(
      within(tokenTable())
        .getAllByRole("columnheader")
        .map(th => th.textContent)
    ).toEqual(["Name", "Prefix", "Created", "Last used", "Actions"]);

    // Below md the same tokens are cards (CSS shows one of the two).
    const cards = screen.getByRole("list", { name: "Your API tokens" });
    expect(
      within(cards)
        .getAllByRole("heading", { level: 3 })
        .map(heading => heading.textContent)
    ).toEqual(["Songbook importer", "Token 9c1e7d3b…", "Laptop scripts"]);
    expect(cards).toHaveClass("md:hidden");
    expect(tokenTable()).toHaveClass("hidden", "md:table");
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(openPage);
  });

  it("shows the empty state when there are no tokens", async () => {
    contributor().tokens = [];
    await openPage();
    expect(
      screen.getByRole("heading", { name: "No tokens yet" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Create a token to let tools like an MCP client work with Bardic Torch for you."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("button", { name: "Create token" })).toBeEnabled();
  });

  it("signed out, offers Log in that comes back here", async () => {
    cookie = undefined;
    await openPage();
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/auth/login?returnTo=%2Fsettings"
    );
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

describe("display name", () => {
  it.each([
    ["", "Enter a display name."],
    ["   ", "Enter a display name."],
    ["x".repeat(65), "Display names can be up to 64 characters."],
    [
      "Morwen\u202e",
      "Display names can’t contain control or invisible formatting characters.",
    ],
  ])("checks %j in the browser before sending: %s", async (value, message) => {
    const user = userEvent.setup();
    await openPage();
    await user.clear(nameField());
    if (value) fireEvent.change(nameField(), { target: { value } });
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(nameField()).toHaveAccessibleDescription(
      expect.stringContaining(`Error: ${message}`)
    );
    expect(nameField()).toHaveAttribute("aria-invalid", "true");
    expect(nameField()).toHaveFocus();
    expect(contributor().me.display_name).toBe("Morwen of the Marches");
  });

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
    expect(contributor().me.display_name).toBe("Wynn of the Long Road");
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
    fail("updateMe", 400, "invalid_request");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(nameField()).toHaveAccessibleDescription(
        expect.stringContaining(`Error: ${DISPLAY_NAME_RULE}`)
      )
    );
    expect(nameField()).toHaveFocus();
    expect(screen.queryByText(/We couldn’t save/)).toBeNull();
  });

  it.each([
    [
      500,
      "internal",
      "We couldn’t save your changes. Check your connection and try again.",
    ],
    [
      403,
      "user_blocked",
      "Your account is blocked, so you can’t make changes. Contact the Bardic Torch team if you think this is a mistake.",
    ],
  ] as const)("a %i %s is a danger alert", async (status, code, message) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const user = userEvent.setup();
    await openPage();
    fail("updateMe", status, code);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const alert = await screen.findByText(message);
    expect(alert.closest('[role="alert"]')).not.toBeNull();
    expect(nameField()).not.toHaveAttribute("aria-invalid");
    expect(
      within(notifications()).queryByText("Display name saved.")
    ).toBeNull();
  });

  it("a session the API ended signs the whole page out, offering Log in back to settings", async () => {
    const user = userEvent.setup();
    const router = await openPage();
    fail("updateMe", 401, "unauthenticated");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    // The proxy cleared the session and the root loader ran again, so the
    // shell (the account control) is signed out too, not only this form.
    expect(
      await screen.findByText(
        "Log in to change your display name and manage your API tokens."
      )
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

  it("saves with Enter in the field", async () => {
    const user = userEvent.setup();
    await openPage();
    await user.clear(nameField());
    await user.type(nameField(), "Wynn the Watchful{Enter}");
    expect(
      await within(notifications()).findByText("Display name saved.")
    ).toBeInTheDocument();
    expect(contributor().me.display_name).toBe("Wynn the Watchful");
  });

  it("announces that it is saving while the request runs", async () => {
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText("Saving your display name…")).toHaveAttribute(
      "role",
      "status"
    );
    await within(notifications()).findByText("Display name saved.");
    expect(screen.queryByText("Saving your display name…")).toBeNull();
  });
});

describe("creating a token", () => {
  it("reveals the new token once, copies it, and clears it from the page", async () => {
    const user = userEvent.setup();
    await openPage();
    await user.type(tokenNameField(), " Laptop MCP ");
    await user.click(screen.getByRole("button", { name: "Create token" }));

    const secret = await screen.findByRole("textbox", {
      name: "New token value",
    });
    expect(
      screen.getByText("Token created. Copy it now — you won’t see it again.")
    ).toBeInTheDocument();
    const value = (secret as HTMLTextAreaElement).value;
    expect(value).toMatch(/^user_api\|[0-9a-f]{64}$/);
    expect(secret).toHaveAttribute("readonly");
    expect(secret).toHaveFocus();
    expect([
      (secret as HTMLTextAreaElement).selectionStart,
      (secret as HTMLTextAreaElement).selectionEnd,
    ]).toEqual([0, value.length]);
    expect(secret.closest('[role="status"]')).not.toBeNull();

    // The list was loaded again and has the new token first; the form is clear.
    expect(within(tokenTable()).getAllByRole("rowheader")[0]).toHaveTextContent(
      "Laptop MCP"
    );
    expect(tokenNameField()).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(await navigator.clipboard.readText()).toBe(value);
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(screen.getByText("Token copied")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "I’ve copied it" }));
    expect(
      screen.queryByRole("textbox", { name: "New token value" })
    ).toBeNull();
    expect(document.body.innerHTML).not.toContain(value);
    expect(screen.getByRole("heading", { name: "API tokens" })).toHaveFocus();
  });

  it("says so when the browser won't copy, leaving the token selected", async () => {
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole("button", { name: "Create token" }));
    const secret = await screen.findByRole("textbox", {
      name: "New token value",
    });
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("denied")
    );
    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(
      await screen.findByText(
        "Your browser didn’t let us copy it. The token is selected: copy it with your keyboard or menu."
      )
    ).not.toHaveClass("sr-only");
    expect(secret).toHaveFocus();
  });

  it("an unnamed token is listed by its prefix", async () => {
    const user = userEvent.setup();
    contributor().tokens = [];
    await openPage();
    await user.click(screen.getByRole("button", { name: "Create token" }));
    await screen.findByRole("textbox", { name: "New token value" });
    const [created] = contributor().tokens;
    expect(created?.name).toBeNull();
    expect(
      within(tokenTable()).getByRole("rowheader", {
        name: `Token ${created?.prefix ?? ""}…`,
      })
    ).toBeInTheDocument();
  });

  it("checks the name's length in the browser before sending", async () => {
    const user = userEvent.setup();
    await openPage();
    fireEvent.change(tokenNameField(), { target: { value: "x".repeat(129) } });
    await user.click(screen.getByRole("button", { name: "Create token" }));

    expect(tokenNameField()).toHaveAccessibleDescription(
      expect.stringContaining("Error: Token names can be up to 128 characters.")
    );
    expect(tokenNameField()).toHaveFocus();
    expect(contributor().tokens).toHaveLength(3);
  });

  it("a 400 from the API is an inline error with the rule", async () => {
    const user = userEvent.setup();
    await openPage();
    fail("createAPIToken", 400, "invalid_request");
    await user.click(screen.getByRole("button", { name: "Create token" }));
    await waitFor(() =>
      expect(tokenNameField()).toHaveAccessibleDescription(
        expect.stringContaining(`Error: ${TOKEN_NAME_RULE}`)
      )
    );
    expect(tokenNameField()).toHaveFocus();
  });

  function tokensFor(count: number) {
    const [sample] = contributor().tokens;
    if (!sample) throw new Error("no sample token");
    return Array.from({ length: count }, (_, index) => ({
      ...sample,
      id: `00000000-0000-4000-8000-0000000001${String(index).padStart(2, "0")}`,
    }));
  }

  it("says how many of the 10 allowed tokens there are", async () => {
    await openPage();
    expect(
      screen.getByText(`You have 3 of ${ACTIVE_TOKEN_LIMIT} API tokens.`)
    ).toBeVisible();
  });

  it("at the limit of 10 says to revoke one, instead of offering the form", async () => {
    contributor().tokens = tokensFor(10);
    await openPage();
    expect(screen.getByText("You have 10 of 10 API tokens.")).toBeVisible();
    expect(
      screen.getByText("That’s the most allowed. Revoke one to create another.")
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Create token" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: /Token name/ })).toBeNull();
  });

  it("if the list is out of date at the limit, the API's 409 still says to revoke one first", async () => {
    const user = userEvent.setup();
    contributor().tokens = tokensFor(9);
    await openPage();
    // Another tab created the tenth meanwhile.
    contributor().tokens = tokensFor(10);
    await user.click(screen.getByRole("button", { name: "Create token" }));

    const message = await screen.findByText(
      "You already have 10 API tokens, the most allowed. Revoke one before creating another."
    );
    expect(message.closest('[role="alert"]')).not.toBeNull();
    expect(
      screen.queryByRole("textbox", { name: "New token value" })
    ).toBeNull();
  });

  it.each([
    [
      403,
      "api_token_not_allowed",
      "API tokens can’t manage API tokens. Log in on the website to do this.",
    ],
    [
      500,
      "internal",
      "We couldn’t create a token. Check your connection and try again.",
    ],
  ] as const)("a %i %s is a danger alert", async (status, code, message) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const user = userEvent.setup();
    await openPage();
    fail("createAPIToken", status, code);
    await user.click(screen.getByRole("button", { name: "Create token" }));
    const alert = await screen.findByText(message);
    expect(alert.closest('[role="alert"]')).not.toBeNull();
  });
});

describe("revoking a token", () => {
  async function openRevoke(name: string) {
    const user = userEvent.setup();
    await openPage();
    const trigger = within(tokenTable()).getByRole("button", {
      name: `Revoke token ${name}`,
    });
    await user.click(trigger);
    return {
      user,
      trigger,
      dialog: screen.getByRole("dialog", { name: "Revoke this token?" }),
    };
  }

  it("confirms with a destructive dialog, removes the token, says so and focuses the heading", async () => {
    const { user, dialog } = await openRevoke("Laptop scripts");
    expect(dialog).toHaveAccessibleDescription(
      "Anything using ‘Laptop scripts’ will stop working straight away. This can’t be undone."
    );
    expect(
      within(dialog).getByRole("button", { name: "Cancel" })
    ).toHaveFocus();

    await user.click(
      within(dialog).getByRole("button", { name: "Revoke token" })
    );

    expect(
      await within(notifications()).findByText("Token revoked.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      within(tokenTable()).queryByRole("rowheader", { name: "Laptop scripts" })
    ).toBeNull();
    expect(contributor().tokens.map(token => token.name)).not.toContain(
      "Laptop scripts"
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "API tokens" })).toHaveFocus()
    );
  });

  it("opens from the keyboard and closes on Escape, back on its button", async () => {
    const user = userEvent.setup();
    await openPage();
    const trigger = within(tokenTable()).getByRole("button", {
      name: "Revoke token Laptop scripts",
    });
    trigger.focus();
    await user.keyboard("{Enter}");
    const dialog = screen.getByRole("dialog", { name: "Revoke this token?" });
    expect(
      within(dialog).getByRole("button", { name: "Cancel" })
    ).toHaveFocus();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
    expect(contributor().tokens).toHaveLength(3);
  });

  it("calls an unnamed token by its prefix", async () => {
    const { dialog } = await openRevoke("Token 9c1e7d3b…");
    expect(dialog).toHaveAccessibleDescription(
      "Anything using token 9c1e7d3b… will stop working straight away. This can’t be undone."
    );
  });

  it("Cancel keeps the token and returns focus to its Revoke button", async () => {
    const { user, trigger, dialog } = await openRevoke("Laptop scripts");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
    expect(contributor().tokens).toHaveLength(3);
  });

  it("a token that is already gone (404) says so, and the list is refreshed", async () => {
    const { user, dialog } = await openRevoke("Laptop scripts");
    contributor().tokens = contributor().tokens.filter(
      token => token.name !== "Laptop scripts"
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Revoke token" })
    );

    const message = await screen.findByText(
      "That token no longer exists. Reload the page to see your current tokens."
    );
    expect(message.closest('[role="alert"]')).not.toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      within(tokenTable()).queryByRole("rowheader", { name: "Laptop scripts" })
    ).toBeNull();
  });

  it("a 500 says it couldn't, and focus goes back to the Revoke button", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { user, trigger, dialog } = await openRevoke("Laptop scripts");
    fail("revokeAPIToken", 500, "internal");
    await user.click(
      within(dialog).getByRole("button", { name: "Revoke token" })
    );

    expect(
      await screen.findByText(
        "We couldn’t revoke that token. Check your connection and try again."
      )
    ).toBeInTheDocument();
    expect(contributor().tokens).toHaveLength(3);
    await waitFor(() => expect(trigger).toHaveFocus());
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
      expect(contributor().me.display_name).toBe("Morwen of the Marches");

      // Once the app answers again, the same form saves.
      platform = undefined;
      await user.click(screen.getByRole("button", { name: "Save changes" }));
      expect(
        await within(notifications()).findByText("Display name saved.")
      ).toBeInTheDocument();
      expect(contributor().me.display_name).toBe("Wynn of the Long Road");
    }
  );

  it.each(cases)(
    "creating a token on %s keeps the typed name and says so inline",
    async (_case, respond, offline) => {
      const user = userEvent.setup();
      await openPage();
      await user.type(tokenNameField(), "Laptop MCP");
      platform = respond;
      await user.click(screen.getByRole("button", { name: "Create token" }));

      const alert = await screen.findByText(
        "We couldn’t create a token. Check your connection and try again."
      );
      expect(alert.closest('[role="alert"]')).not.toBeNull();
      expect(tokenNameField()).toHaveValue("Laptop MCP");
      expect(
        screen.queryByRole("textbox", { name: "New token value" })
      ).toBeNull();
      expectNoBoundary();
      await expectOfflineToast(offline);
      expect(contributor().tokens).toHaveLength(3);
    }
  );

  it.each(cases)(
    "revoking a token on %s keeps it and says so inline",
    async (_case, respond, offline) => {
      const user = userEvent.setup();
      await openPage();
      const trigger = within(tokenTable()).getByRole("button", {
        name: "Revoke token Laptop scripts",
      });
      await user.click(trigger);
      platform = respond;
      await user.click(
        within(
          screen.getByRole("dialog", { name: "Revoke this token?" })
        ).getByRole("button", { name: "Revoke token" })
      );

      expect(
        await screen.findByText(
          "We couldn’t revoke that token. Check your connection and try again."
        )
      ).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(
        within(tokenTable()).getByRole("rowheader", { name: "Laptop scripts" })
      ).toBeInTheDocument();
      expectNoBoundary();
      await expectOfflineToast(offline);
      await waitFor(() => expect(trigger).toHaveFocus());
    }
  );
});

describe("settings error boundary", () => {
  it("a token list that fails to load shows the boundary, and Try again recovers", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const user = userEvent.setup();
    fail("listAPITokens", 500, "internal");
    await renderSettings();

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "We couldn’t load your settings",
      })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Settings" })
    ).toBeInTheDocument();
    expect(nameField()).toHaveValue("Morwen of the Marches");
  });
});

describe("settings shouldRevalidate", () => {
  const base = {
    currentUrl: new URL("https://app.test/settings"),
    nextUrl: new URL("https://app.test/settings"),
    currentParams: {},
    nextParams: {},
    defaultShouldRevalidate: true,
  };

  const submitted = (intent: string, actionResult: unknown) => {
    const formData = new FormData();
    formData.set("intent", intent);
    return {
      ...base,
      formMethod: "POST" as const,
      formAction: "/settings",
      formData,
      actionResult,
    };
  };
  const failure = (code: string) => ({
    ok: false,
    error: { code, message: "" },
  });

  it.each([
    ["create-token", { ok: true, data: {} }, true],
    ["revoke-token", { ok: true, data: null }, true],
    ["revoke-token", failure("not_found"), true],
    ["create-token", failure("token_limit_reached"), false],
    ["create-token", failure("offline"), false],
    ["revoke-token", failure("unexpected_response"), false],
    ["revoke-token", failure("upstream_unavailable"), false],
    ["update-profile", { ok: true, data: {} }, false],
  ])("after %s answered %j: %s", (intent, result, expected) => {
    expect(shouldRevalidate(submitted(intent, result))).toBe(expected);
  });

  it("follows the default otherwise (Try again revalidates)", () => {
    expect(shouldRevalidate(base)).toBe(true);
    expect(shouldRevalidate({ ...base, defaultShouldRevalidate: false })).toBe(
      false
    );
  });
});
