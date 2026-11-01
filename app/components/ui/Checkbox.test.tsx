import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { Checkbox, CheckboxGroup } from "./Checkbox";

function marks(box: HTMLElement) {
  const [check, minus] = [
    ...(box.parentElement?.querySelectorAll("svg") ?? []),
  ];
  return { check, minus };
}

describe("Checkbox", () => {
  it("is a native checkbox named by its label text only", () => {
    render(
      <Checkbox
        label="Email me about replies"
        help="At most one email a day."
      />
    );
    const box = screen.getByRole("checkbox", {
      name: "Email me about replies",
    });
    expect(box).toHaveAttribute("type", "checkbox");
    expect(box).toHaveAccessibleDescription("At most one email a day.");
  });

  it("toggles from a click anywhere on the row, and with Space", async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Singalong" help="Songs everyone can join." />);
    const box = screen.getByRole("checkbox");
    await user.click(screen.getByText("Songs everyone can join."));
    expect(box).toBeChecked();
    // The click focused the box, as a label click does.
    expect(box).toHaveFocus();
    await user.keyboard(" ");
    expect(box).not.toBeChecked();
  });

  it("draws the box from tokens and fills it with the accent when checked", () => {
    render(<Checkbox label="Singalong" defaultChecked />);
    const box = screen.getByRole("checkbox");
    expect(box).toBeChecked();
    expect(box).toHaveClass(
      "appearance-none",
      "h-5",
      "w-5",
      "rounded-sm",
      "border-2",
      "border-border-strong",
      "bg-surface-raised",
      "checked:bg-accent",
      "checked:border-accent"
    );
    const { check } = marks(box);
    expect(check).toHaveAttribute("aria-hidden", "true");
    expect(check).toHaveClass("hidden", "peer-checked:block", "text-accent-fg");
  });

  it("hands the box to the system in forced colours, hiding the drawn marks", () => {
    render(<Checkbox label="Singalong" defaultChecked />);
    const box = screen.getByRole("checkbox");
    expect(box).toHaveClass("forced-colors:appearance-auto");
    const { check, minus } = marks(box);
    expect(check).toHaveClass("forced-colors:!hidden");
    expect(minus).toHaveClass("forced-colors:!hidden");
  });

  it("has an indeterminate state with a bar instead of the tick", () => {
    const { rerender } = render(<Checkbox label="All moods" indeterminate />);
    const box = screen.getByRole("checkbox") as HTMLInputElement;
    expect(box.indeterminate).toBe(true);
    expect(box).toBePartiallyChecked();
    const { check, minus } = marks(box);
    expect(minus).toHaveClass("peer-indeterminate:block");
    expect(check).toHaveClass("peer-indeterminate:hidden");
    rerender(<Checkbox label="All moods" />);
    expect(box.indeterminate).toBe(false);
  });

  it("is disabled natively, with subtle label text", async () => {
    render(<Checkbox label="Singalong" disabled />);
    const box = screen.getByRole("checkbox");
    expect(box).toBeDisabled();
    expect(box).toHaveClass(
      "disabled:bg-input-bg-locked",
      // A strong edge, so the empty box stays visible in dark (on surface).
      "disabled:border-border-strong"
    );
    expect(screen.getByText("Singalong")).toHaveClass("text-fg-subtle");
    await userEvent.click(screen.getByText("Singalong"));
    expect(box).not.toBeChecked();
  });

  it("shows its own error under the row", () => {
    render(
      <Checkbox
        label="I agree to the licence"
        error="Agree to the licence to continue."
      />
    );
    const box = screen.getByRole("checkbox");
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveClass("border-danger-icon");
    expect(box).toHaveAccessibleDescription(
      "Error: Agree to the licence to continue."
    );
  });

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      render(
        <>
          <Checkbox label="One" />
          <Checkbox label="Two" defaultChecked />
        </>
      )
    );
  });
});

describe("CheckboxGroup", () => {
  it("is a fieldset named by its legend, with help", () => {
    render(
      <CheckboxGroup legend="Moods" help="Pick any that fit." optional>
        <Checkbox label="Singalong" />
        <Checkbox label="Sombre" />
      </CheckboxGroup>
    );
    const group = screen.getByRole("group", { name: "Moods (optional)" });
    expect(group.tagName).toBe("FIELDSET");
    expect(group).toHaveAccessibleDescription("Pick any that fit.");
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });

  it("puts one error below the group and marks every box", () => {
    render(
      <CheckboxGroup legend="Moods" error="Choose at least one mood.">
        <Checkbox label="Singalong" />
        <Checkbox label="Sombre" />
      </CheckboxGroup>
    );
    expect(screen.getByRole("group")).toHaveAccessibleDescription(
      "Error: Choose at least one mood."
    );
    for (const box of screen.getAllByRole("checkbox")) {
      expect(box).toHaveAttribute("aria-invalid", "true");
      expect(box).toHaveClass("border-danger-icon");
    }
  });

  it("moves between boxes with Tab", async () => {
    const user = userEvent.setup();
    render(
      <CheckboxGroup legend="Moods">
        <Checkbox label="Singalong" />
        <Checkbox label="Sombre" />
      </CheckboxGroup>
    );
    await user.tab();
    expect(screen.getByRole("checkbox", { name: "Singalong" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("checkbox", { name: "Sombre" })).toHaveFocus();
  });
});
