import { IconBook2, IconHistory, IconPencil } from "@tabler/icons-react";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "~/test/router";
import { ViewTabs } from "./Tabs";

const READ = { label: "Read", to: "/help/licence", icon: IconBook2 };
const VIEWS = [
  READ,
  { label: "Edit", to: "/help/licence/edit", icon: IconPencil },
  { label: "History", to: "/help/licence/history", icon: IconHistory },
] as const;

describe("ViewTabs", () => {
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
});
