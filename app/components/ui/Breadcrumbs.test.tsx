import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "~/test/router";
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
  it("follows a crumb from the keyboard", async () => {
    const user = userEvent.setup();
    const router = await renderWithRouter(<HelpCrumbs />, "/help/licence");
    await act(() => user.tab());
    expect(screen.getByRole("link", { name: "Help" })).toHaveFocus();
    await act(() => user.keyboard("{Enter}"));
    expect(router.state.location.pathname).toBe("/help");
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
  });
});
