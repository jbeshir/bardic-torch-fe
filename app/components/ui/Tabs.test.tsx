import { IconBook2, IconHistory, IconPencil } from "@tabler/icons-react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { Tabs, ViewTabs } from "./Tabs";

const READ = { label: "Read", to: "/help/licence", icon: IconBook2 };
const VIEWS = [
  READ,
  { label: "Edit", to: "/help/licence/edit", icon: IconPencil },
  { label: "History", to: "/help/licence/history", icon: IconHistory },
] as const;

const PANELS = [
  { label: "Light", content: <p>Light preview</p> },
  { label: "Dark", content: <p>Dark preview</p> },
  { label: "Side by side", content: <p>Both previews</p> },
] as const;

describe("ViewTabs", () => {
  it("shows a single view as plain text: no nav, no link, no tab stop", async () => {
    const user = userEvent.setup();
    await renderWithRouter(<ViewTabs views={[READ]} current={READ.to} />);
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
    const read = screen.getByText("Read");
    expect(read).toHaveAttribute("aria-current", "page");
    expect(read).toHaveClass("border-b-3", "border-accent", "font-semibold");
    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it("shows two or more views as links in a Page views nav, marking the current one", async () => {
    await renderWithRouter(
      <ViewTabs views={VIEWS} current={READ.to} />,
      READ.to
    );
    const nav = screen.getByRole("navigation", { name: "Page views" });
    const links = within(nav).getAllByRole("link");
    expect(links.map(link => link.textContent)).toEqual([
      "Read",
      "Edit",
      "History",
    ]);
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(links[0]).toHaveClass("border-accent", "text-fg");
    expect(links[1]).not.toHaveAttribute("aria-current");
    expect(links[1]).toHaveClass("border-transparent", "text-fg-muted");
    for (const link of links) {
      expect(link).toHaveClass("min-h-11", "focus-visible:-outline-offset-2");
      expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("moves between views with Tab and follows with Enter", async () => {
    const user = userEvent.setup();
    const router = await renderWithRouter(
      <ViewTabs views={VIEWS} current={READ.to} />,
      READ.to
    );
    await act(() => user.tab());
    await act(() => user.tab());
    expect(screen.getByRole("link", { name: "Edit" })).toHaveFocus();
    await act(() => user.keyboard("{Enter}"));
    expect(router.state.location.pathname).toBe("/help/licence/edit");
  });

  it("sits on the title rule with page meta at the right", async () => {
    await renderWithRouter(
      <ViewTabs
        views={[READ]}
        current={READ.to}
        meta="Adapted from the original wiki"
      />
    );
    const meta = screen.getByText("Adapted from the original wiki");
    expect(meta).toHaveClass("text-caption", "text-fg-subtle");
    expect(meta.parentElement).toHaveClass("border-b", "border-border");
  });

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(<ViewTabs views={VIEWS} current={READ.to} />)
    );
  });
});

describe("Tabs", () => {
  it("renders every panel under its heading, and hides the tablist, before hydration", () => {
    document.body.innerHTML = renderToString(
      <Tabs label="Preview" panels={PANELS} headingLevel={2} />
    );
    const tablist = document.querySelector("[role=tablist]");
    expect(tablist).toHaveAttribute("hidden");
    expect(tablist).toHaveClass("hidden");
    expect(document.querySelector("[role=tabpanel]")).toBeNull();
    const headings = [...document.querySelectorAll("section > h2")];
    expect(headings.map(heading => heading.textContent)).toEqual([
      "Light",
      "Dark",
      "Side by side",
    ]);
    expect(document.body).toHaveTextContent("Both previews");
    document.body.innerHTML = "";
  });

  it("becomes a tablist with JS: one tab stop, the selected panel only", () => {
    render(<Tabs label="Preview" panels={PANELS} defaultIndex={2} />);
    const tablist = screen.getByRole("tablist", { name: "Preview" });
    expect(tablist).not.toHaveAttribute("hidden");
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.map(tab => tab.getAttribute("tabindex"))).toEqual([
      "-1",
      "-1",
      "0",
    ]);
    expect(tabs[2]).toHaveAttribute("aria-selected", "true");
    const panel = screen.getByRole("tabpanel", { name: "Side by side" });
    expect(panel).toHaveTextContent("Both previews");
    expect(panel).toHaveAttribute("tabindex", "0");
    expect(tabs[2]).toHaveAttribute("aria-controls", panel.id);
    expect(screen.queryByText("Light preview")).not.toBeVisible();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("moves and activates with the arrow keys, wrapping, and jumps with Home and End", async () => {
    const user = userEvent.setup();
    render(<Tabs label="Preview" panels={PANELS} />);
    const tab = (name: string) => screen.getByRole("tab", { name });
    const shown = () => screen.getByRole("tabpanel").textContent;

    await user.tab();
    expect(tab("Light")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(tab("Dark")).toHaveFocus();
    expect(tab("Dark")).toHaveAttribute("aria-selected", "true");
    expect(shown()).toBe("Dark preview");
    await user.keyboard("{End}");
    expect(tab("Side by side")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(tab("Light")).toHaveFocus();
    expect(shown()).toBe("Light preview");
    await user.keyboard("{ArrowLeft}");
    expect(tab("Side by side")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(tab("Light")).toHaveFocus();
    expect(tab("Side by side")).toHaveAttribute("tabindex", "-1");
  });

  it("goes from the tab into the panel with Tab", async () => {
    const user = userEvent.setup();
    render(<Tabs label="Preview" panels={PANELS} />);
    await user.tab();
    await user.tab();
    expect(screen.getByRole("tabpanel")).toHaveFocus();
  });

  it("selects with a click", async () => {
    render(<Tabs label="Preview" panels={PANELS} />);
    await userEvent.click(screen.getByRole("tab", { name: "Dark" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Dark preview");
  });

  it("styles the selected tab as raised on the sunken track", () => {
    render(<Tabs label="Preview" panels={PANELS} />);
    expect(screen.getByRole("tablist")).toHaveClass(
      "bg-surface-sunken",
      "rounded-lg",
      "p-1"
    );
    expect(screen.getByRole("tab", { name: "Light" })).toHaveClass(
      "aria-selected:bg-surface-raised",
      "aria-selected:shadow-1",
      "min-h-9"
    );
  });

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      render(<Tabs label="Preview" panels={PANELS} />)
    );
  });
});
