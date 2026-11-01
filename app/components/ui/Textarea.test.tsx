import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { Field } from "./Field";
import { Textarea } from "./Textarea";

describe("Textarea", () => {
  it("is five lines tall at least and resizes vertically", () => {
    render(<Textarea aria-label="Notes" />);
    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveClass(
      "min-h-textarea",
      "resize-y",
      "py-2.5",
      "bg-input-bg",
      "border-border-strong"
    );
  });

  it("is wired to its Field and accepts multi-line text from the keyboard", async () => {
    render(
      <Field label="Notes" help="Anything a moderator should know." optional>
        <Textarea />
      </Field>
    );
    const textarea = screen.getByRole("textbox", { name: "Notes (optional)" });
    expect(textarea).toHaveAccessibleDescription(
      "Anything a moderator should know."
    );
    await userEvent.tab();
    expect(textarea).toHaveFocus();
    await userEvent.keyboard("One{Enter}Two");
    expect(textarea).toHaveValue("One\nTwo");
  });

  it("shows the error edge and is invalid in the error state", () => {
    render(
      <Field label="Notes" error="Keep notes under 500 characters.">
        <Textarea />
      </Field>
    );
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(textarea).toHaveClass("border-danger-icon", "ring-danger-icon");
  });

  it.each([
    ["disabled", { disabled: true }, "disabled:bg-input-bg-locked"],
    ["read-only", { readOnly: true }, "bg-input-bg-locked"],
  ] as const)("has a %s state", (_state, props, cls) => {
    render(<Textarea aria-label="Notes" {...props} />);
    expect(screen.getByRole("textbox")).toHaveClass(cls);
  });

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      render(<Textarea aria-label="Notes" />)
    );
  });
});
