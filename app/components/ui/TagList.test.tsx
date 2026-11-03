import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { wikiPageUrl } from "~/constants/navigation";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { TagList } from "./TagList";

const WIKI = wikiPageUrl("Category:Moods");

describe("TagList", () => {
  it("is a list of link chips", async () => {
    await renderWithRouter(
      <TagList
        tags={[
          { label: "Help", to: "/help" },
          { label: "Conservation", to: "/help/conservation-status" },
        ]}
      />
    );
    const list = screen.getByRole("list");
    expect(list).toHaveAttribute("role", "list");
    // Centred on one line, so a small chip sits level with full-size ones.
    expect(list).toHaveClass("flex", "flex-wrap", "items-center", "gap-2");
    const links = within(list).getAllByRole("link");
    expect(links.map(link => link.getAttribute("href"))).toEqual([
      "/help",
      "/help/conservation-status",
    ]);
    expect(links[0]).toHaveClass(
      "rounded-full",
      "bg-surface-sunken",
      "text-link",
      "hover:bg-accent-subtle",
      "hover:text-link-hover"
    );
  });

  it("puts the facet before the term, in the name too", async () => {
    await renderWithRouter(
      <TagList tags={[{ label: "Singalong", to: "/x", prefix: "Mood:" }]} />
    );
    expect(
      screen.getByRole("link", { name: "Mood: Singalong" })
    ).toBeInTheDocument();
    expect(screen.getByText("Mood:")).toHaveClass(
      "font-normal",
      "text-fg-muted"
    );
  });

  it("marks a chip to any other site as an external link", async () => {
    await renderWithRouter(
      <TagList tags={[{ label: "Licence", to: "https://example.org/x" }]} />
    );
    expect(
      screen.getByRole("link", { name: "Licence (external link)" })
    ).toHaveAttribute("href", "https://example.org/x");
  });

  it("marks chips to the wiki as going to the original wiki", async () => {
    await renderWithRouter(<TagList tags={[{ label: "Moods", to: WIKI }]} />);
    const chip = screen.getByRole("link", {
      name: "Moods (opens original wiki)",
    });
    expect(chip).toHaveAttribute("href", WIKI);
    expect(chip).toHaveAttribute("rel", "noopener");
    expect(chip.querySelector("svg")).toHaveAttribute("width", "14");
  });

  it("marks the current term with aria-current and an inset ring", async () => {
    await renderWithRouter(
      <TagList tags={[{ label: "Singalong", to: "/x", current: true }]} />
    );
    const chip = screen.getByRole("link", { name: "Singalong" });
    expect(chip).toHaveAttribute("aria-current", "page");
    expect(chip).toHaveClass(
      "bg-accent-subtle",
      "text-accent-text",
      "border-accent",
      "focus-visible:-outline-offset-2"
    );
  });

  it.each([
    ["md", ["min-h-9", "lg:min-h-8"]],
    ["sm", ["min-h-7"]],
  ] as const)("has %s chips", async (size, classes) => {
    await renderWithRouter(
      <TagList size={size} tags={[{ label: "Help", to: "/help" }]} />
    );
    expect(screen.getByRole("link")).toHaveClass(...classes);
  });

  it("says when there are no tags", async () => {
    await renderWithRouter(<TagList tags={[]} />);
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByText("No categories yet.")).toHaveClass(
      "text-caption",
      "text-fg-subtle"
    );
  });

  it("moves between chips with Tab and follows with Enter", async () => {
    const user = userEvent.setup();
    const router = await renderWithRouter(
      <TagList
        tags={[
          { label: "Help", to: "/help" },
          { label: "Licence", to: "/help/licence" },
        ]}
      />
    );
    await act(() => user.tab());
    await act(() => user.tab());
    expect(screen.getByRole("link", { name: "Licence" })).toHaveFocus();
    await act(() => user.keyboard("{Enter}"));
    expect(router.state.location.pathname).toBe("/help/licence");
  });

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(
        <TagList
          tags={[
            { label: "Singalong", to: "/x", prefix: "Mood:" },
            { label: "Moods", to: WIKI },
          ]}
        />
      )
    );
  });
});
