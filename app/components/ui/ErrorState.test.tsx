import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
} from "react-router-dom/server";
import { describe, expect, it } from "vitest";
import { renderRoutes, renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { ButtonLink } from "./Button";
import { ErrorState, SectionError, TryAgain } from "./ErrorState";

/** The server render of `element` as the page at `url`. */
async function renderOnServer(element: ReactElement, url: string) {
  const routes = [{ path: "*", element }];
  const handler = createStaticHandler(routes);
  const context = await handler.query(new Request(`http://localhost${url}`));
  if (context instanceof Response) throw new Error("unexpected redirect");
  const router = createStaticRouter(routes, context);
  return renderToString(
    <StaticRouterProvider router={router} context={context} hydrate={false} />
  );
}

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

describe("ErrorState", () => {
  it("heads the page with an h1 and says what to do", async () => {
    await renderWithRouter(<ServerError />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Something went wrong" })
    ).toBeInTheDocument();
    expect(screen.getByText(/That’s on us, not you/)).toHaveClass(
      "text-fg-muted"
    );
    expect(screen.getByRole("button", { name: "Try again" })).toHaveClass(
      "bg-accent"
    );
    expect(
      screen.getByRole("link", { name: "Go to the home page" })
    ).toHaveAttribute("href", "/");
  });

  it("shows the Sentry reference in mono when there is one, and nothing otherwise", async () => {
    await renderWithRouter(<ServerError reference="7f3a2c9e" />);
    expect(screen.getByText("Reference: 7f3a2c9e")).toHaveClass(
      "font-mono",
      "text-fg-subtle"
    );
    act(() => {
      document.body.innerHTML = "";
    });
    await renderWithRouter(<ServerError />);
    expect(screen.queryByText(/Reference/)).toBeNull();
  });

  it("draws the broken torch for errors and the plain unlit one for missing pages", async () => {
    await renderWithRouter(<ServerError />);
    const broken = document.querySelector("svg path[stroke-dasharray]");
    expect(broken).not.toBeNull();
    act(() => {
      document.body.innerHTML = "";
    });
    await renderWithRouter(
      <ErrorState
        title="We couldn’t find that page"
        art="missing"
        actions={<ButtonLink to="/">Go to the home page</ButtonLink>}
      >
        It may have moved.
      </ErrorState>
    );
    expect(document.querySelector("svg path[stroke-dasharray]")).toBeNull();
    expect(document.querySelector("svg")).toHaveClass("h-16", "w-16");
  });

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

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(<ServerError reference="7f3a" />)
    );
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

describe("SectionError", () => {
  it("is a danger alert with the cause and a small Try again", async () => {
    await renderWithRouter(
      <SectionError title="We couldn’t load your profile">
        The account service didn’t answer.
      </SectionError>
    );
    expect(
      screen.getByText("We couldn’t load your profile").closest(".bg-danger-bg")
    ).not.toBeNull();
    expect(screen.getByText(/didn’t answer/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toHaveClass(
      "min-h-9"
    );
  });
});
