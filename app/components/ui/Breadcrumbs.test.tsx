import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderOnServer, renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { Breadcrumbs } from "./Breadcrumbs";

/** A five-item trail: four ancestors and the page. */
function TermCrumbs() {
  return (
    <Breadcrumbs
      trail={[
        { label: "Categories", to: "/categories" },
        { label: "Topic", to: "/categories?facet=topic" },
        { label: "Warfare", to: "/categories/warfare" },
        { label: "Weapons", to: "/categories/weapons" },
      ]}
      current="Swords"
    />
  );
}

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

  describe("more than three items", () => {
    const item = (label: string) =>
      screen.getByRole("link", { name: label }).closest("li");

    it("collapses the middle ancestors below sm behind a Show full path button", async () => {
      await renderWithRouter(<TermCrumbs />, "/categories/swords");
      const more = screen.getByRole("button", { name: "Show full path" });
      expect(more).toHaveTextContent("…");
      expect(more).toHaveAttribute("aria-expanded", "false");
      expect(more).toHaveClass("min-h-6", "min-w-6");
      // The button only exists below sm; the crumbs it stands for hide there.
      expect(more.closest("li")).toHaveClass("sm:hidden");
      expect(item("Topic")).toHaveClass("max-sm:hidden");
      expect(item("Warfare")).toHaveClass("max-sm:hidden");
      // The first ancestor, the parent and the page always show.
      expect(item("Categories")).not.toHaveClass("max-sm:hidden");
      expect(item("Weapons")).not.toHaveClass("max-sm:hidden");
      // In order: first ancestor, "…", the collapsed ones, the parent, page.
      const items = within(screen.getByRole("list")).getAllByRole("listitem");
      expect(items.map(each => each.textContent)).toEqual([
        "Categories",
        "…",
        "Topic",
        "Warfare",
        "Weapons",
        "Swords",
      ]);
    });

    it("expands from the keyboard and moves focus to the first revealed crumb", async () => {
      const user = userEvent.setup();
      await renderWithRouter(<TermCrumbs />, "/categories/swords");
      await act(() => user.tab());
      await act(() => user.tab());
      const more = screen.getByRole("button", { name: "Show full path" });
      expect(more).toHaveFocus();
      await act(() => user.keyboard("{Enter}"));
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.getByRole("link", { name: "Topic" })).toHaveFocus();
      for (const label of ["Topic", "Warfare"]) {
        expect(item(label)).not.toHaveClass("max-sm:hidden");
      }
    });

    it("expands with Space too", async () => {
      const user = userEvent.setup();
      await renderWithRouter(<TermCrumbs />, "/categories/swords");
      act(() => screen.getByRole("button", { name: "Show full path" }).focus());
      await act(() => user.keyboard(" "));
      expect(screen.getByRole("link", { name: "Topic" })).toHaveFocus();
    });

    it("keeps a three-item trail whole", async () => {
      await renderWithRouter(
        <Breadcrumbs
          trail={[
            { label: "Help", to: "/help" },
            { label: "Contributing", to: "/help/contributing" },
          ]}
          current="Summaries"
        />
      );
      expect(screen.queryByRole("button")).toBeNull();
      expect(document.querySelector(".max-sm\\:hidden")).toBeNull();
    });

    it("wraps the full trail without JS", async () => {
      const html = await renderOnServer(<TermCrumbs />, "/categories/swords");
      const page = document.createElement("div");
      page.innerHTML = html;
      expect(page.querySelector("button")).toBeNull();
      expect(page.querySelectorAll("li")).toHaveLength(5);
      expect(page.innerHTML).not.toContain("max-sm:hidden");
    });
  });

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(() => renderWithRouter(<HelpCrumbs />));
    await expectSameMarkupInBothThemes(() => renderWithRouter(<TermCrumbs />));
  });
});
