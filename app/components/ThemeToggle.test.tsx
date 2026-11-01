import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "~/components/ui/Toast";
import type { ThemeChoice } from "~/constants/theme";
import {
  ThemeChoiceProvider,
  useThemeChoice,
} from "~/contexts/ThemeChoiceContext";
import { ThemeToggle } from "./ThemeToggle";

/** What the document root renders from: the shared optimistic choice. */
function RootProbe() {
  const { choice } = useThemeChoice();
  return <output aria-label="Root theme">{choice}</output>;
}

type Sent = { url: string; method: string; body: string };

const OFFLINE_TOAST =
  "You seem to be offline. Your changes haven't been saved yet.";
const SAVE_FAILED = "Couldn't save your theme. Try again.";

/** The theme route's answer to a save. */
const saved = (theme: ThemeChoice) =>
  Response.json({ ok: true, data: { theme } });

/**
 * Renders the toggle the way the app does (inside the theme provider and
 * the toasts, under a router with an error boundary that must never show)
 * with `fetch` answered by `respond`.
 */
async function renderToggle({
  loaded = "system",
  respond = async () => saved("dark"),
  placement = "drawer",
}: {
  loaded?: ThemeChoice;
  respond?: (sent: Sent) => Promise<Response>;
  placement?: "header" | "drawer";
} = {}) {
  const sent: Sent[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const request = {
      url,
      method: init.method ?? "GET",
      body: String(init.body),
    };
    sent.push(request);
    return respond(request);
  });
  const router = createMemoryRouter(
    [
      {
        path: "/help/licence",
        element: (
          <ThemeChoiceProvider loaded={loaded}>
            <ToastProvider>
              <ThemeToggle placement={placement} />
              <RootProbe />
            </ToastProvider>
          </ThemeChoiceProvider>
        ),
        errorElement: <p>Error boundary</p>,
      },
    ],
    { initialEntries: ["/help/licence?x=1"] }
  );
  await act(async () => {
    render(<RouterProvider router={router} />);
  });
  return { sent };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

async function group() {
  return screen.findByRole("group", { name: "Theme" });
}

function pressed() {
  return screen
    .getAllByRole("button")
    .filter(button => button.getAttribute("aria-pressed") === "true")
    .map(button => button.textContent);
}

function rootTheme() {
  return screen.getByRole("status", { name: "Root theme" });
}

async function choose(name: string) {
  await act(() => userEvent.click(screen.getByRole("button", { name })));
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("data-theme");
});

describe.each(["light", "dark"])("ThemeToggle (page in %s)", pageTheme => {
  it("renders System, Light and Dark under a visible Theme label", async () => {
    document.documentElement.dataset.theme = pageTheme;
    await renderToggle();
    const buttons = within(await group()).getAllByRole("button");
    expect(buttons.map(button => button.textContent)).toEqual([
      "System",
      "Light",
      "Dark",
    ]);
    expect(screen.getByText("Theme")).toBeVisible();
  });
});

describe("ThemeToggle", () => {
  it("in the header: icon-only at md with hidden names, text from lg, the error floating below", async () => {
    await renderToggle({
      placement: "header",
      respond: async () => new Response("", { status: 503 }),
    });
    const buttons = within(await group()).getAllByRole("button");
    expect(buttons.map(button => button.textContent)).toEqual([
      "System",
      "Light",
      "Dark",
    ]);
    for (const button of buttons) {
      expect(button).toHaveClass("min-h-8", "min-w-9");
      expect(button.querySelector("span")).toHaveClass(
        "sr-only",
        "lg:not-sr-only"
      );
    }
    await choose("Dark");
    expect(await screen.findByText(SAVE_FAILED)).toHaveClass(
      "absolute",
      "top-full"
    );
  });

  it("in the drawer: 44 px buttons sharing the width, with visible text", async () => {
    await renderToggle();
    for (const button of within(await group()).getAllByRole("button")) {
      expect(button).toHaveClass("min-h-11", "flex-1");
      expect(button.querySelector("span")).not.toHaveAttribute("class");
    }
  });

  it.each([
    ["system", "System"],
    ["light", "Light"],
    ["dark", "Dark"],
  ] as const)(
    "presses only the saved choice (%s → %s)",
    async (loaded, label) => {
      await renderToggle({ loaded });
      await group();
      expect(pressed()).toEqual([label]);
      for (const button of screen.getAllByRole("button")) {
        expect(button).toHaveAttribute(
          "aria-pressed",
          String(button.textContent === label)
        );
      }
    }
  );

  it("is a real form that works without JS", async () => {
    await renderToggle();
    const form = (await group()).closest("form");
    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveAttribute("action", "/resources/theme");
    const returnTo = form?.querySelector('input[name="returnTo"]');
    expect(returnTo).toHaveAttribute("type", "hidden");
    expect(returnTo).toHaveValue("/help/licence?x=1");
    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveAttribute("type", "submit");
      expect(button).toHaveAttribute("name", "theme");
    }
    expect(
      screen.getAllByRole("button").map(button => button.getAttribute("value"))
    ).toEqual(["system", "light", "dark"]);
  });

  it("shows the new choice immediately and keeps it once the server agrees", async () => {
    const answer = deferred<Response>();
    const { sent } = await renderToggle({ respond: () => answer.promise });
    await group();
    await choose("Dark");

    expect(pressed()).toEqual(["Dark"]);
    expect(rootTheme()).toHaveTextContent("dark");
    // No returnTo, so the theme route answers JSON instead of a redirect.
    expect(sent).toEqual([
      { url: "/resources/theme", method: "POST", body: "theme=dark" },
    ]);

    await act(async () => answer.resolve(saved("dark")));
    await waitFor(() => expect(rootTheme()).toHaveTextContent("dark"));
    expect(pressed()).toEqual(["Dark"]);
    expect(screen.queryByText(SAVE_FAILED)).toBeNull();
  });

  it.each([
    [
      "the theme route's own failure",
      async () =>
        Response.json(
          {
            ok: false,
            error: { code: "invalid_theme", message: "Choose System…" },
          },
          { status: 400 }
        ),
    ],
    [
      "a 503 the app didn't make",
      async () => new Response("", { status: 503 }),
    ],
    [
      "an HTML error page from a gateway",
      async () =>
        new Response("<!doctype html><title>Bad gateway</title>", {
          status: 502,
          headers: { "Content-Type": "text/html" },
        }),
    ],
    ["a 200 that isn't the route's JSON", async () => new Response("ok")],
  ])(
    "on %s goes back to the saved choice and says so inline",
    async (_case, respond) => {
      await renderToggle({ loaded: "light", respond });
      await group();
      await choose("Dark");

      expect(await screen.findByText(SAVE_FAILED)).toHaveAttribute(
        "role",
        "alert"
      );
      expect(pressed()).toEqual(["Light"]);
      expect(rootTheme()).toHaveTextContent("light");
      expect(screen.queryByText("Error boundary")).toBeNull();
      expect(screen.queryByText(OFFLINE_TOAST)).toBeNull();
    }
  );

  it("offline: goes back, says so inline and in a danger toast", async () => {
    await renderToggle({
      loaded: "light",
      respond: () => Promise.reject(new TypeError("Failed to fetch")),
    });
    await group();
    await choose("Dark");

    expect(await screen.findByText(SAVE_FAILED)).toBeVisible();
    expect(await screen.findByText(OFFLINE_TOAST)).toBeInTheDocument();
    expect(pressed()).toEqual(["Light"]);
    expect(screen.queryByText("Error boundary")).toBeNull();
  });

  it("clears the error with the next successful save", async () => {
    let fail = true;
    await renderToggle({
      respond: async () =>
        fail ? new Response("", { status: 503 }) : saved("light"),
    });
    await group();
    await choose("Dark");
    expect(await screen.findByText(SAVE_FAILED)).toHaveAttribute(
      "role",
      "alert"
    );

    fail = false;
    await choose("Light");
    await waitFor(() => expect(screen.queryByText(SAVE_FAILED)).toBeNull());
    expect(pressed()).toEqual(["Light"]);
  });

  it("lets a later choice win over an earlier answer that arrives last", async () => {
    const first = deferred<Response>();
    let calls = 0;
    await renderToggle({
      respond: () => {
        calls += 1;
        return calls === 1 ? first.promise : Promise.resolve(saved("light"));
      },
    });
    await group();
    await choose("Dark");
    await choose("Light");
    await waitFor(() => expect(pressed()).toEqual(["Light"]));

    await act(async () => first.resolve(new Response("", { status: 503 })));
    expect(pressed()).toEqual(["Light"]);
    expect(screen.queryByText(SAVE_FAILED)).toBeNull();
  });

  it("works from the keyboard: Tab to an option, Enter or Space to choose", async () => {
    const user = userEvent.setup();
    const { sent } = await renderToggle({
      respond: async ({ body }) =>
        saved(body === "theme=light" ? "light" : "system"),
    });
    await group();

    await user.tab();
    expect(screen.getByRole("button", { name: "System" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Light" })).toHaveFocus();
    await act(() => user.keyboard("{Enter}"));
    expect(pressed()).toEqual(["Light"]);

    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "System" })).toHaveFocus();
    await act(() => user.keyboard(" "));
    expect(pressed()).toEqual(["System"]);
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent.map(request => request.body)).toEqual([
      "theme=light",
      "theme=system",
    ]);
  });
});
