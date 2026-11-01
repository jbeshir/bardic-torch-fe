import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { WIKI_SEARCH } from "~/constants/navigation";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { SearchBox } from "./SearchBox";

describe("SearchBox", () => {
  it("is a GET search form to the original wiki, named for screen readers", async () => {
    await renderWithRouter(<SearchBox size="md" />);
    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", WIKI_SEARCH.action);
    const input = screen.getByRole("searchbox", {
      name: "Search the original wiki",
    });
    expect(input).toHaveAttribute("name", WIKI_SEARCH.param);
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toHaveAttribute("enterkeyhint", "search");
    expect(input).toHaveAttribute("placeholder", "Search the wiki…");
  });

  it("spells out the original wiki in the placeholder where the field is wide", async () => {
    await renderWithRouter(<SearchBox size="lg" />);
    expect(screen.getByRole("searchbox")).toHaveAttribute(
      "placeholder",
      "Search the original wiki…"
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
    expect(screen.getByRole("button")).toHaveClass("hover:bg-fg/10");
    expect(screen.getByRole("button")).not.toHaveClass(
      "hover:bg-surface-sunken"
    );
  });

  it("has a submit button marked as going to the wiki, so it works without Enter", async () => {
    await renderWithRouter(<SearchBox size="md" />);
    const submit = screen.getByRole("button", {
      name: "Search the original wiki (opens original wiki)",
    });
    expect(submit).toHaveAttribute("type", "submit");
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
