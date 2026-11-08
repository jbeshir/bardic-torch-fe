import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SEARCH } from "~/constants/navigation";
import { renderOnServer, renderRoutes, renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { SearchBox } from "./SearchBox";

describe("SearchBox", () => {
  it("is a GET search form to the catalogue's search, named for screen readers", async () => {
    await renderWithRouter(<SearchBox size="md" />);
    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", SEARCH.action);
    const input = screen.getByRole("searchbox", {
      name: "Search the catalogue",
    });
    expect(input).toHaveAttribute("name", SEARCH.param);
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toHaveAttribute("enterkeyhint", "search");
    expect(input).toHaveAttribute("placeholder", "Search…");
    expect(input).toHaveValue("");
  });

  it("works without JS: the server render is the plain GET form", async () => {
    const page = document.createElement("div");
    page.innerHTML = await renderOnServer(<SearchBox size="lg" />);
    const form = page.querySelector("form");
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/search");
    expect(page.querySelector('input[name="q"]')).not.toBeNull();
    expect(page.querySelector('button[type="submit"]')).not.toBeNull();
  });

  it("is prefilled with defaultValue", async () => {
    await renderWithRouter(<SearchBox size="lg" defaultValue="kettle" />);
    expect(screen.getByRole("searchbox")).toHaveValue("kettle");
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

  it("names the catalogue in the placeholder where the field is wide", async () => {
    await renderWithRouter(<SearchBox size="lg" />);
    expect(screen.getByRole("searchbox")).toHaveAttribute(
      "placeholder",
      "Search pieces and bards…"
    );
    expect(screen.queryByTestId("search-long-placeholder")).toBeNull();
  });

  it("in the header, shows the long placeholder from lg, in place of the short one, while empty", async () => {
    await renderWithRouter(<SearchBox size="md" />);
    const input = screen.getByRole("searchbox");
    expect(input).toHaveClass("peer", "lg:placeholder:text-transparent");
    const hint = screen.getByTestId("search-long-placeholder");
    expect(hint).toHaveTextContent("Search pieces and bards…");
    expect(hint).toHaveAttribute("aria-hidden", "true");
    expect(hint).toHaveClass("hidden", "lg:peer-placeholder-shown:flex");
    // After the input: the peer variant only looks at earlier siblings.
    expect(input.compareDocumentPosition(hint)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it.each([
    ["md", ["h-8", "w-8", "before:-inset-1.5"]],
    ["lg", ["h-11", "w-11"]],
  ] as const)(
    "at size %s the submit is a 44 px target below lg",
    async (size, classes) => {
      await renderWithRouter(<SearchBox size={size} />);
      expect(screen.getByRole("button")).toHaveClass(...classes);
    }
  );

  it("washes the submit on hover with a see-through tint, visible on either theme's field", async () => {
    await renderWithRouter(<SearchBox size="lg" />);
    expect(screen.getByRole("button")).toHaveClass("hover:bg-fg-10");
    expect(screen.getByRole("button")).not.toHaveClass(
      "hover:bg-surface-sunken"
    );
  });

  it("has a Search submit button, so it works without Enter, with no external mark", async () => {
    await renderWithRouter(<SearchBox size="md" />);
    const submit = screen.getByRole("button", { name: "Search" });
    expect(submit).toHaveAttribute("type", "submit");
    expect(submit.querySelector(".tabler-icon-search")).not.toBeNull();
    expect(submit.querySelector(".tabler-icon-arrow-up-right")).toBeNull();
  });

  it.each([
    ["md", "h-10"],
    ["lg", "h-11"],
  ] as const)("at size %s the field is %s", async (size, height) => {
    await renderWithRouter(<SearchBox size={size} />);
    expect(screen.getByRole("searchbox")).toHaveClass(height, "rounded-full");
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

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(<SearchBox size="md" />)
    );
  });
});
