import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { CatalogueError, FilterError, failureTitle } from "./CatalogueError";

const heading = () => screen.getByRole("heading", { level: 1 });

describe("failureTitle", () => {
  it.each([
    [{ kind: "resting", retryAfter: 60 }, "Bardic Torch is resting"],
    [{ kind: "server" }, "We couldn’t load the pieces"],
    [{ kind: "bad_gateway" }, "Something went wrong"],
    [{ kind: "search_timeout" }, "That search took too long"],
    [{ kind: "invalid_filters" }, "We couldn’t apply these filters"],
  ] as const)("titles %o “%s”", (failure, title) => {
    expect(failureTitle(failure, "the pieces")).toBe(title);
  });

  it("says what is missing for a 404", () => {
    expect(failureTitle({ kind: "not_found" }, "this category")).toBe(
      "We couldn’t find that page"
    );
    expect(
      failureTitle({ kind: "not_found" }, "this category", "that category")
    ).toBe("We couldn’t find that category");
  });
});

describe("CatalogueError", () => {
  it("is the 404 page, titled for what is missing", async () => {
    await renderWithRouter(
      <CatalogueError
        failure={{ kind: "not_found" }}
        what="this category"
        missing="that category"
      />,
      "/categories/no-such"
    );
    expect(heading()).toHaveTextContent("We couldn’t find that category");
    expect(
      screen.getByRole("link", { name: "Go to the home page" })
    ).toHaveAttribute("href", "/");
  });

  it("is the resting page for an outage, with no reference", async () => {
    await renderWithRouter(
      <CatalogueError
        failure={{ kind: "resting", retryAfter: 60 }}
        what="the pieces"
      />
    );
    expect(heading()).toHaveTextContent("Bardic Torch is resting");
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
    expect(screen.queryByText(/Reference/)).toBeNull();
  });

  it("says what didn't load for a server error", async () => {
    await renderWithRouter(
      <CatalogueError failure={{ kind: "server" }} what="the pieces" />
    );
    expect(heading()).toHaveTextContent("We couldn’t load the pieces");
    expect(screen.getByText(/That’s on us, not you/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  it("says the answer was unreadable for a bad gateway", async () => {
    await renderWithRouter(
      <CatalogueError failure={{ kind: "bad_gateway" }} what="the pieces" />
    );
    expect(heading()).toHaveTextContent("Something went wrong");
    expect(
      screen.getByText(
        "We got an unexpected answer from our servers. Try again shortly."
      )
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Go to the home page" })
    ).toHaveAttribute("href", "/");
  });

  it.each([
    { kind: "resting", retryAfter: 30 },
    { kind: "server" },
    { kind: "bad_gateway" },
  ] as const)("has the same markup in both themes: %o", async failure => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(<CatalogueError failure={failure} what="the pieces" />)
    );
  });
});

describe("FilterError", () => {
  it("keeps the page's controls under a slow search's message", async () => {
    await renderWithRouter(
      <FilterError failure={{ kind: "search_timeout" }} clearHref="/pieces">
        <input aria-label="Search pieces" />
      </FilterError>
    );
    expect(heading()).toHaveTextContent("That search took too long");
    expect(
      screen.getByText(
        "Try fewer words or fewer filters, or browse by category."
      )
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "Search pieces" })
    ).toBeVisible();
  });

  it("offers to clear filters the API refused", async () => {
    await renderWithRouter(
      <FilterError failure={{ kind: "invalid_filters" }} clearHref="/pieces">
        <p>chips</p>
      </FilterError>
    );
    expect(heading()).toHaveTextContent("We couldn’t apply these filters");
    expect(
      screen.getByText("One of the filters in this link isn’t valid any more.")
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Clear all filters" })
    ).toHaveAttribute("href", "/pieces");
    expect(screen.getByText("chips")).toBeVisible();
  });

  it("can be left with the keyboard", async () => {
    await renderWithRouter(
      <FilterError failure={{ kind: "invalid_filters" }} clearHref="/pieces">
        <p>chips</p>
      </FilterError>
    );
    const clear = screen.getByRole("link", { name: "Clear all filters" });
    clear.focus();
    expect(clear).toHaveFocus();
  });

  it.each([{ kind: "search_timeout" }, { kind: "invalid_filters" }] as const)(
    "has the same markup in both themes: %o",
    async failure => {
      await expectSameMarkupInBothThemes(() =>
        renderWithRouter(
          <FilterError failure={failure} clearHref="/pieces">
            <p>chips</p>
          </FilterError>
        )
      );
    }
  );
});

describe("CatalogueError on an entity page (C4.1)", () => {
  it("titles a not-found failure with what wasn't found", () => {
    expect(
      failureTitle({ kind: "not_found" }, "this piece", "that piece")
    ).toBe("We couldn’t find that piece");
    expect(failureTitle({ kind: "not_found" }, "this piece")).toBe(
      "We couldn’t find that page"
    );
  });

  it("is the 404 page for not found, with the way home", async () => {
    await renderWithRouter(
      <CatalogueError
        failure={{ kind: "not_found" }}
        what="this piece"
        missing="that piece"
      />,
      "/pieces/the-lost-lay"
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "We couldn’t find that piece",
      })
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Go to the home page" })
    ).toHaveAttribute("href", "/");
  });
});
