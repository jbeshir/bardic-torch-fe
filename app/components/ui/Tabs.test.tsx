import { IconBook2, IconHistory, IconPencil } from "@tabler/icons-react";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { ViewTabs } from "./Tabs";

const READ = { label: "Read", to: "/help/licence", icon: IconBook2 };
const VIEWS = [
  READ,
  { label: "Edit", to: "/help/licence/edit", icon: IconPencil },
  { label: "History", to: "/help/licence/history", icon: IconHistory },
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
    expect(meta.parentElement).toHaveClass("sm:border-b", "border-border");
  });

  it("below sm puts the rule under the tabs and the meta under the rule, so the bar stays on it", async () => {
    await renderWithRouter(
      <ViewTabs
        views={VIEWS}
        current={READ.to}
        meta="Adapted from the original wiki"
      />
    );
    const tabs = screen.getByTestId("view-tabs");
    expect(tabs).toHaveClass("border-b", "sm:border-b-0");
    expect(tabs.nextElementSibling).toHaveTextContent(
      "Adapted from the original wiki"
    );
    // The row of tabs never wraps.
    expect(screen.getByRole("list")).not.toHaveClass("flex-wrap");
  });

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(<ViewTabs views={VIEWS} current={READ.to} />)
    );
  });
});
