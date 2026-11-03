import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { Field } from "./Field";
import { Select } from "./Select";

function Moods() {
  return (
    <>
      <option value="singalong">Singalong</option>
      <option value="sombre">Sombre</option>
      <option value="warlike">Warlike</option>
    </>
  );
}

describe("Select", () => {
  it("is a native select with the Input look and a decorative chevron", () => {
    render(
      <Select aria-label="Mood">
        <Moods />
      </Select>
    );
    const select = screen.getByRole("combobox", { name: "Mood" });
    expect(select.tagName).toBe("SELECT");
    expect(select).toHaveClass(
      "appearance-none",
      "pr-10",
      "min-h-11",
      "bg-input-bg"
    );
    const chevron = select.parentElement?.querySelector("svg");
    expect(chevron).toHaveAttribute("aria-hidden", "true");
    expect(chevron).toHaveClass("pointer-events-none", "text-fg-muted");
  });

  it("is labelled and described by its Field", () => {
    render(
      <Field label="Mood" help="Pick the closest.">
        <Select>
          <Moods />
        </Select>
      </Field>
    );
    const select = screen.getByRole("combobox", { name: "Mood" });
    expect(select).toHaveAccessibleDescription("Pick the closest.");
    expect(select).toBeRequired();
  });

  it("changes value from the keyboard", async () => {
    render(
      <Select aria-label="Mood">
        <Moods />
      </Select>
    );
    const select = screen.getByRole("combobox");
    await userEvent.tab();
    expect(select).toHaveFocus();
    await userEvent.selectOptions(select, "warlike");
    expect(select).toHaveValue("warlike");
  });

  it("has error and disabled states", () => {
    render(
      <>
        <Field label="Mood" error="Choose a mood.">
          <Select>
            <Moods />
          </Select>
        </Field>
        <Select aria-label="Culture" disabled>
          <Moods />
        </Select>
      </>
    );
    expect(screen.getByRole("combobox", { name: "Mood" })).toHaveClass(
      "border-danger-icon"
    );
    expect(screen.getByRole("combobox", { name: "Culture" })).toBeDisabled();
  });

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      render(
        <Select aria-label="Mood">
          <Moods />
        </Select>
      )
    );
  });
});
