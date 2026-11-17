import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderOnServer, renderRoutes, renderWithRouter } from "~/test/router";
import { SearchBox } from "./SearchBox";

describe("SearchBox", () => {
  it("works without JS: the server render is the plain GET form", async () => {
    const page = document.createElement("div");
    page.innerHTML = await renderOnServer(<SearchBox size="lg" />);
    const form = page.querySelector("form");
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/search");
    expect(page.querySelector('input[name="q"]')).not.toBeNull();
    expect(page.querySelector('button[type="submit"]')).not.toBeNull();
  });

  it("goes with JS straight to the canonical search, trimmed", async () => {
    const user = userEvent.setup();
    const router = await renderRoutes(
      [
        { path: "/", element: <SearchBox size="md" /> },
        { path: "/search", element: <p>Results</p> },
      ],
      "/"
    );
    await user.type(screen.getByRole("searchbox"), "  copper kettle {Enter}");
    expect(router.state.location.pathname).toBe("/search");
    expect(router.state.location.search).toBe("?q=copper+kettle");
  });

  it("goes to the empty search page for an empty search", async () => {
    const user = userEvent.setup();
    const router = await renderRoutes(
      [
        { path: "/", element: <SearchBox size="lg" /> },
        { path: "/search", element: <p>Results</p> },
      ],
      "/"
    );
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(router.state.location.pathname).toBe("/search");
    expect(router.state.location.search).toBe("");
  });

  it("is reached by Tab: the field, then the button", async () => {
    const user = userEvent.setup();
    await renderWithRouter(<SearchBox size="lg" />);
    await user.tab();
    expect(screen.getByRole("searchbox")).toHaveFocus();
    await user.keyboard("ballad");
    expect(screen.getByRole("searchbox")).toHaveValue("ballad");
    await user.tab();
    expect(screen.getByRole("button")).toHaveFocus();
  });
});
