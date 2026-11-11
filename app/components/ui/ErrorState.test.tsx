import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { hydrateRoot } from "react-dom/client";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { describe, expect, it } from "vitest";
import { renderOnServer, renderRoutes, renderWithRouter } from "~/test/router";
import { ButtonLink } from "./Button";
import { ErrorState, TryAgain, UnderPageHead } from "./ErrorState";

function ServerError({ reference }: { reference?: string }) {
  return (
    <ErrorState
      title="Something went wrong"
      reference={reference}
      actions={
        <>
          <TryAgain variant="primary" />
          <ButtonLink to="/">Go to the home page</ButtonLink>
        </>
      }
    >
      That’s on us, not you. Try again in a moment.
    </ErrorState>
  );
}

describe("ErrorState under a page head", () => {
  it("is an h2, so the page keeps its one h1", async () => {
    await renderWithRouter(
      <>
        <h1>Swords</h1>
        <UnderPageHead>
          <ServerError />
        </UnderPageHead>
      </>
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const heading = screen.getByRole("heading", {
      level: 2,
      name: "Something went wrong",
    });
    expect(heading).toHaveClass("text-h2", "text-fg");
    expect(heading).toHaveAttribute("tabindex", "-1");
  });
});

describe("ErrorState", () => {
  it("moves focus to the heading when it replaces a page on the client", async () => {
    await renderWithRouter(<ServerError />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });

  it("leaves focus alone in a server-rendered page while it hydrates", async () => {
    const url = "/missing";
    const container = document.createElement("div");
    container.innerHTML = await renderOnServer(<ServerError />, url);
    document.body.appendChild(container);
    // Hydrating server HTML, which renderRoutes (a fresh render) can't do.
    const router = createMemoryRouter(
      [{ path: "*", element: <ServerError /> }],
      {
        initialEntries: [url],
      }
    );
    await act(async () => {
      hydrateRoot(container, <RouterProvider router={router} />);
    });
    expect(screen.getByRole("heading", { level: 1 })).not.toHaveFocus();
    container.remove();
  });
});

describe("TryAgain", () => {
  it("without JS is a link that loads the same address again", async () => {
    document.body.innerHTML = await renderOnServer(
      <TryAgain />,
      "/help/licence?section=2"
    );
    const link = screen.getByRole("link", { name: "Try again" });
    expect(link).toHaveAttribute("href", "/help/licence?section=2");
    expect(link).toHaveClass("border-border-strong");
    document.body.innerHTML = "";
  });

  it("with JS re-runs the loaders in place, busy while they run", async () => {
    let calls = 0;
    let finish: (value: null) => void = () => undefined;
    // The first run is the page load; the retry stays pending until finished.
    const loader = () => {
      calls += 1;
      if (calls === 1) return null;
      return new Promise<null>(resolve => {
        finish = resolve;
      });
    };
    await renderRoutes([{ path: "/", loader, element: <TryAgain /> }]);
    const button = await screen.findByRole("button", { name: "Try again" });
    await act(() => userEvent.click(button));
    expect(calls).toBe(2);
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    await act(async () => finish(null));
    expect(button).not.toHaveAttribute("aria-busy");
  });
});
