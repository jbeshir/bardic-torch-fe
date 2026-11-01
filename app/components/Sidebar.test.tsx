import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NAV_GROUPS } from "~/constants/navigation";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { Sidebar } from "./Sidebar";

async function renderSidebar(url = "/") {
  return renderWithRouter(
    <nav aria-label="Site">
      <Sidebar />
    </nav>,
    url
  );
}

describe("Sidebar", () => {
  it("has the Browse, Facets and Help groups under their headings, then the ContributeCard", async () => {
    await renderSidebar();
    expect(
      screen.getAllByRole("heading", { level: 3 }).map(h => h.textContent)
    ).toEqual(["Browse", "Facets", "Help", "Keep the torch lit"]);
    expect(
      screen.getByText(
        "The catalogue is on its way. Until it opens, these links go to the original Bardic Torch wiki."
      )
    ).toBeInTheDocument();
  });

  it("lists every item from the navigation config, in order", async () => {
    await renderSidebar();
    const lists = screen.getAllByRole("list");
    expect(lists).toHaveLength(NAV_GROUPS.length);
    NAV_GROUPS.forEach((group, index) => {
      const links = within(lists[index] as HTMLElement).getAllByRole("link");
      expect(links.map(link => link.getAttribute("href"))).toEqual(
        group.items.map(item => item.href)
      );
    });
  });

  it("marks wiki links as external: an arrow, and the hidden destination, in the same tab", async () => {
    await renderSidebar();
    const pieces = screen.getByRole("link", {
      name: "Pieces (opens original wiki)",
    });
    expect(pieces).not.toHaveAttribute("target");
    expect(pieces).toHaveAttribute("rel", "noopener");
    expect(pieces.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(
      screen.getByRole("link", { name: "Contributing" }).querySelector("svg")
    ).toBeNull();
  });

  it("marks the help page being shown as current", async () => {
    await renderSidebar("/help/faq-for-bards");
    const current = screen.getByRole("link", { name: "FAQ for bards" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current).toHaveClass(
      "bg-accent-subtle",
      "text-accent-text",
      "shadow-current-bar"
    );
    expect(
      screen
        .getAllByRole("link")
        .filter(link => link.hasAttribute("aria-current"))
    ).toEqual([current]);
  });

  it("has 44 px items below lg and 32 px from lg", async () => {
    await renderSidebar();
    for (const link of within(
      screen.getAllByRole("list")[0] as HTMLElement
    ).getAllByRole("link")) {
      expect(link).toHaveClass("min-h-11", "lg:min-h-8");
    }
  });

  it("invites contributions with a link to the contributing guide", async () => {
    await renderSidebar();
    expect(
      screen.getByRole("link", { name: "Start contributing" })
    ).toHaveAttribute("href", "/help/contributing");
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(() => renderSidebar("/help/licence"));
  });
});
