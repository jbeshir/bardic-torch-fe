import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type {
  FacetGroup as Group,
  FacetOption,
} from "~/catalogue/facet-groups";
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

  it("ticks and unticks a box with Space, focus staying on it", async () => {
    const user = userEvent.setup();
    render(<FacetGroup group={MOOD} />);
    await user.tab();
    const warlike = screen.getByRole("checkbox", { name: /^Warlike/ });
    expect(warlike).toHaveFocus();
    expect(warlike).toBeChecked();
    await user.keyboard(" ");
    expect(warlike).not.toBeChecked();
    expect(warlike).toHaveFocus();
    // The disabled box is skipped: Tab goes on to the next live one.
    await user.tab();
    const child = screen.getByRole("checkbox", { name: /^Battle-cries/ });
    expect(child).toHaveFocus();
    await user.keyboard(" ");
    expect(child).toBeChecked();
    expect(child).toHaveFocus();
  });

  it("reaches Show all with Tab, keeps focus on it as it opens and closes, and ticks the rest with Space", async () => {
    const user = userEvent.setup();
    render(<FacetGroup group={LONG} />);
    const summary = screen.getByText("Show all 10").closest("summary");
    const details = summary?.closest("details");
    if (!summary || !details) throw new Error("no disclosure");
    // After the eight boxes shown, the disclosure is the next stop.
    for (let i = 0; i < 9; i++) await user.tab();
    expect(summary).toHaveFocus();
    // Enter and Space on a summary are the browser's own activation, which
    // jsdom doesn't dispatch: activate it as they do, with a click on the
    // focused summary.
    await user.click(summary);
    expect(details).toHaveAttribute("open");
    expect(summary).toHaveFocus();
    await user.tab();
    const more = screen.getByRole("checkbox", { name: /^Mood8/ });
    expect(more).toHaveFocus();
    await user.keyboard(" ");
    expect(more).toBeChecked();
    expect(more).toHaveFocus();
    await user.tab({ shift: true });
    expect(summary).toHaveFocus();
    await user.click(summary);
    expect(details).not.toHaveAttribute("open");
    expect(summary).toHaveFocus();
    // Closed, the ticked box is still in the form.
    expect(
      screen.getByRole("checkbox", { name: /^Mood8/, hidden: true })
    ).toBeChecked();
  });
});
