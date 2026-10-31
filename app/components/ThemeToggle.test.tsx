import { json } from "@remix-run/cloudflare";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { URLSearchParams as NodeURLSearchParams } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ThemeChoice } from "~/constants/theme";
import { useThemeChoice } from "~/hooks/useThemeChoice";
import { ThemeToggle } from "./ThemeToggle";

type Saved = "light" | "dark" | null;
type ActionResult = { ok: true; theme: ThemeChoice } | { ok: false };

/** What the document root would render: the shared optimistic choice. */
function RootProbe() {
  const choice = useThemeChoice();
  return <output aria-label="Root theme">{choice}</output>;
}

/**
 * Renders the toggle under a stand-in root route (id "root", loader giving
 * the saved theme) and a /resources/theme action the test controls.
 */
async function renderToggle({
  saved = null,
  respond = async () => ({ ok: true, theme: "dark" }),
  placement = "drawer",
}: {
  saved?: Saved;
  respond?: (choice: string | null) => Promise<ActionResult>;
  placement?: "header" | "drawer";
} = {}) {
  let theme: Saved = saved;
  const submissions: Array<Record<string, string>> = [];
  const router = createMemoryRouter(
    [
      {
        id: "root",
        path: "/",
        loader: () => json({ theme }),
        element: (
          <>
            <ThemeToggle placement={placement} />
            <RootProbe />
          </>
        ),
        children: [{ path: "help/licence", element: null }],
      },
      {
        path: "/resources/theme",
        action: async ({ request }) => {
          const form = Object.fromEntries(
            [...(await request.formData())].map(([key, value]) => [
              key,
              String(value),
            ])
          );
          submissions.push(form);
          const result = await respond(form.theme ?? null);
          if (result.ok)
            theme = result.theme === "system" ? null : result.theme;
          return json(result, { status: result.ok ? 200 : 400 });
        },
      },
    ],
    { initialEntries: ["/help/licence?x=1"] }
  );
  await act(async () => {
    render(<RouterProvider router={router} />);
  });
  /** Resolves once the save and the root revalidation after it are done. */
  const settled = () =>
    waitFor(() => {
      expect(router.state.fetchers.get("theme")?.state ?? "idle").toBe("idle");
      expect(router.state.revalidation).toBe("idle");
    });
  return { submissions, settled };
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

beforeEach(() => {
  // The router builds a Node `Request` from a `URLSearchParams` body, and
  // Node's Request only accepts its own URLSearchParams, not jsdom's.
  vi.stubGlobal("URLSearchParams", NodeURLSearchParams);
});

afterEach(() => {
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
      respond: async () => ({ ok: false }),
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
    await act(() =>
      userEvent.click(screen.getByRole("button", { name: "Dark" }))
    );
    expect(await screen.findByRole("alert")).toHaveClass(
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

  it("keeps the saved choice once the server agrees, without the root loader running again", async () => {
    let loads = 0;
    const router = createMemoryRouter(
      [
        {
          id: "root",
          path: "/",
          loader: () => {
            loads += 1;
            return json({ theme: null });
          },
          shouldRevalidate: () => false,
          element: (
            <>
              <ThemeToggle placement="drawer" />
              <RootProbe />
            </>
          ),
        },
        {
          path: "/resources/theme",
          action: () => json({ ok: true, theme: "dark" }),
        },
      ],
      { initialEntries: ["/"] }
    );
    await act(async () => {
      render(<RouterProvider router={router} />);
    });
    await group();
    await act(() =>
      userEvent.click(screen.getByRole("button", { name: "Dark" }))
    );
    await waitFor(() =>
      expect(router.state.fetchers.get("theme")?.state ?? "idle").toBe("idle")
    );
    expect(loads).toBe(1);
    expect(pressed()).toEqual(["Dark"]);
    expect(
      screen.getByRole("status", { name: "Root theme" })
    ).toHaveTextContent("dark");
  });

  it.each([
    [null, "System"],
    ["light", "Light"],
    ["dark", "Dark"],
  ] as const)(
    "presses only the saved choice (%s → %s)",
    async (saved, label) => {
      await renderToggle({ saved });
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

  it("shows the new choice immediately, before the server answers", async () => {
    const answer = deferred<ActionResult>();
    const { submissions, settled } = await renderToggle({
      respond: () => answer.promise,
    });
    await group();
    await act(() =>
      userEvent.click(screen.getByRole("button", { name: "Dark" }))
    );

    expect(pressed()).toEqual(["Dark"]);
    expect(
      screen.getByRole("status", { name: "Root theme" })
    ).toHaveTextContent("dark");
    // The fetcher sends no returnTo, so the action answers without a redirect.
    expect(submissions).toEqual([{ theme: "dark" }]);

    await act(async () => answer.resolve({ ok: true, theme: "dark" }));
    await settled();
    expect(pressed()).toEqual(["Dark"]);
    expect(
      screen.getByRole("status", { name: "Root theme" })
    ).toHaveTextContent("dark");
  });

  it("goes back to the saved choice and says so when saving fails", async () => {
    const { settled } = await renderToggle({
      saved: "light",
      respond: async () => ({ ok: false }),
    });
    await group();
    await act(() =>
      userEvent.click(screen.getByRole("button", { name: "Dark" }))
    );

    await settled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't save your theme. Try again."
    );
    expect(pressed()).toEqual(["Light"]);
    expect(
      screen.getByRole("status", { name: "Root theme" })
    ).toHaveTextContent("light");
  });

  it("works from the keyboard: Tab to an option, Enter or Space to choose", async () => {
    const user = userEvent.setup();
    const { submissions, settled } = await renderToggle({
      respond: async choice => ({
        ok: true,
        theme: choice === "light" ? "light" : "system",
      }),
    });
    await group();

    await user.tab();
    expect(screen.getByRole("button", { name: "System" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Light" })).toHaveFocus();
    await act(() => user.keyboard("{Enter}"));
    expect(pressed()).toEqual(["Light"]);
    await settled();

    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "System" })).toHaveFocus();
    await act(() => user.keyboard(" "));
    expect(pressed()).toEqual(["System"]);
    await settled();
    expect(submissions.map(form => form.theme)).toEqual(["light", "system"]);
  });
});
