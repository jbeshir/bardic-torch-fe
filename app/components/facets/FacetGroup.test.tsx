import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type {
  FacetGroup as Group,
  FacetOption,
} from "~/catalogue/facet-groups";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { FacetGroup } from "./FacetGroup";

function option(
  value: string,
  overrides: Partial<FacetOption> = {}
): FacetOption {
  return {
    value,
    label: value[0]?.toUpperCase() + value.slice(1),
    count: 3,
    depth: 0,
    selected: false,
    disabled: false,
    ...overrides,
  };
}

const MOOD: Group = {
  key: "mood",
  name: "term",
  legend: "Mood",
  shown: [
    option("warlike", { count: 31, selected: true }),
    option("eerie", { count: 0, disabled: true }),
    option("battle-cries", { depth: 1, count: 1 }),
  ],
  more: [],
};

const LONG: Group = {
  ...MOOD,
  shown: Array.from({ length: 8 }, (_, i) => option(`mood${i}`)),
  more: [option("mood8"), option("mood9")],
};

describe("FacetGroup", () => {
  it("is a fieldset named by its legend, with a box per option", () => {
    render(<FacetGroup group={MOOD} />);
    const group = screen.getByRole("group", { name: "Mood" });
    expect(within(group).getAllByRole("checkbox")).toHaveLength(3);
  });

  it("names each box with its count in words, and shows the count in brackets", () => {
    render(<FacetGroup group={MOOD} />);
    const warlike = screen.getByRole("checkbox", {
      // "Warlike, 31 pieces" in a browser; the test setup spaces inline children.
      name: /^Warlike ?, 31 pieces$/,
    });
    expect(warlike).toHaveAttribute("name", "term");
    expect(warlike).toHaveAttribute("value", "warlike");
    expect(warlike).toBeChecked();
    expect(screen.getByText("(31)")).toHaveAttribute("aria-hidden", "true");
    expect(
      screen.getByRole("checkbox", { name: /^Battle-cries.*1 piece$/ })
    ).not.toBeChecked();
  });

  it("greys and disables an option nothing would match", () => {
    render(<FacetGroup group={MOOD} />);
    const eerie = screen.getByRole("checkbox", { name: /^Eerie/ });
    expect(eerie).toBeDisabled();
    expect(screen.getByText("(0)")).toHaveClass("text-fg-subtle");
  });

  it("indents a term under its parent", () => {
    render(<FacetGroup group={MOOD} />);
    const child = screen.getByRole("checkbox", { name: /^Battle-cries/ });
    expect(child.closest("li")).toHaveClass("pl-6");
    expect(
      screen.getByRole("checkbox", { name: /^Warlike/ }).closest("li")
    ).not.toHaveClass("pl-6");
  });

  it("shows the rest of a long group behind Show all, a native disclosure", async () => {
    const user = userEvent.setup();
    render(<FacetGroup group={LONG} />);
    const details = screen.getByText("Show all 10").closest("details");
    if (!details) throw new Error("no details");
    expect(details).not.toHaveAttribute("open");
    // Closed, the rest are still in the form (a closed details keeps them).
    expect(
      within(details).getAllByRole("checkbox", { hidden: true })
    ).toHaveLength(2);
    const summary = within(details).getByText("Show all 10").closest("summary");
    if (!summary) throw new Error("no summary");
    expect(summary).toHaveTextContent(/Show all 10.* mood options/);
    await user.click(summary);
    expect(details).toHaveAttribute("open");
    expect(summary).toHaveFocus();
  });

  it("has no disclosure for a short group", () => {
    render(<FacetGroup group={MOOD} />);
    expect(screen.queryByText(/Show all/)).toBeNull();
  });

  it("has the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      render(<FacetGroup group={LONG} />)
    );
  });
});
