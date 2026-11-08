import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { wikiPageUrl } from "~/constants/navigation";
import { renderOnServer, renderWithRouter } from "~/test/router";
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

  describe("more than 12 chips", () => {
    const tags = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        label: `Topic ${index + 1}`,
        to: `/topics/${index + 1}`,
      }));
    const shown = () =>
      within(screen.getByRole("list"))
        .getAllByRole("listitem")
        .filter(item => !item.hidden)
        .map(item => item.textContent);

    it("shows the first 12 and a Show all disclosure for the rest", async () => {
      await renderWithRouter(<TagList tags={tags(15)} />);
      expect(shown()).toEqual(tags(12).map(({ label }) => label));
      const toggle = screen.getByRole("button", {
        name: "Show all 15 categories",
      });
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(toggle).toHaveAttribute(
        "aria-controls",
        screen.getByRole("list").id
      );
      expect(toggle).toHaveClass("bg-transparent", "min-h-9");
    });

    it("shows and hides the rest from the keyboard, keeping focus on the toggle", async () => {
      const user = userEvent.setup();
      await renderWithRouter(<TagList tags={tags(13)} />);
      const toggle = screen.getByRole("button", {
        name: "Show all 13 categories",
      });
      act(() => toggle.focus());
      await act(() => user.keyboard("{Enter}"));
      expect(toggle).toHaveFocus();
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(toggle).toHaveAccessibleName("Show fewer");
      expect(shown()).toHaveLength(13);
      await act(() => user.keyboard(" "));
      expect(toggle).toHaveFocus();
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(toggle).toHaveAccessibleName("Show all 13 categories");
      expect(shown()).toHaveLength(12);
    });

    it("skips the hidden chips when tabbing", async () => {
      const user = userEvent.setup();
      await renderWithRouter(<TagList tags={tags(13)} />);
      for (let step = 0; step < 13; step += 1) {
        await act(() => user.tab());
      }
      expect(
        screen.getByRole("button", { name: "Show all 13 categories" })
      ).toHaveFocus();
    });

    it("keeps exactly 12 chips as they are", async () => {
      await renderWithRouter(<TagList tags={tags(12)} />);
      expect(screen.queryByRole("button")).toBeNull();
      expect(shown()).toHaveLength(12);
    });

    it("shows every chip, with no button, without JS", async () => {
      const html = await renderOnServer(<TagList tags={tags(15)} />);
      const page = document.createElement("div");
      page.innerHTML = html;
      expect(page.querySelectorAll("li")).toHaveLength(15);
      expect(page.querySelectorAll("li[hidden]")).toHaveLength(0);
      expect(page.querySelector("button")).toBeNull();
    });
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
