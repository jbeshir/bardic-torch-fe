import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { Breadcrumbs } from "./Breadcrumbs";

function HelpCrumbs() {
  return (
    <Breadcrumbs
      trail={[{ label: "Help", to: "/help" }]}
      current="Licence and attribution"
    />
  );
}

describe("Breadcrumbs", () => {
  it("is a Breadcrumb nav with an ordered list ending in the current page", async () => {
    await renderWithRouter(<HelpCrumbs />, "/help/licence");
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const items = within(within(nav).getByRole("list")).getAllByRole(
      "listitem"
    );
    expect(nav.querySelector("ol")).not.toBeNull();
    expect(items.map(item => item.textContent)).toEqual([
      "Help",
      "Licence and attribution",
    ]);
    const current = within(nav).getByText("Licence and attribution");
    expect(current.tagName).toBe("SPAN");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current).toHaveClass("text-fg-muted");
    expect(within(nav).getAllByRole("link")).toHaveLength(1);
  });

  it("links the ancestors, with 24 px targets and decorative chevrons", async () => {
    await renderWithRouter(<HelpCrumbs />, "/help/licence");
    const link = screen.getByRole("link", { name: "Help" });
    expect(link).toHaveAttribute("href", "/help");
    expect(link).toHaveClass(
      "inline-flex",
      "min-h-6",
      "text-link",
      "no-underline",
      "hover:underline"
    );
    // Each item, the current page's too, starts with its chevron, so a
    // wrapped line never ends with one (the list hides a line's first).
    const marks = [...document.querySelectorAll("li > .separated-list-mark")];
    expect(marks).toHaveLength(2);
    for (const mark of marks) {
      expect(mark).toHaveAttribute("aria-hidden", "true");
      expect(mark.querySelector("svg")).not.toBeNull();
    }
    expect(link.previousElementSibling).toBe(marks[0]);
  });

  it("follows a crumb from the keyboard", async () => {
    const user = userEvent.setup();
    const router = await renderWithRouter(<HelpCrumbs />, "/help/licence");
    await act(() => user.tab());
    expect(screen.getByRole("link", { name: "Help" })).toHaveFocus();
    await act(() => user.keyboard("{Enter}"));
    expect(router.state.location.pathname).toBe("/help");
  });

  it("wraps rather than overflowing at narrow widths", async () => {
    await renderWithRouter(<HelpCrumbs />);
    expect(screen.getByRole("list")).toHaveClass("separated-list", "gap-y-2");
  });

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(() => renderWithRouter(<HelpCrumbs />));
  });
});
