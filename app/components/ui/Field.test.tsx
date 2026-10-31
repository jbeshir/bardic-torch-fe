import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { Field } from "./Field";
import { Input } from "./Input";

const HELP = "Shown on your edits and in page history.";

describe("Field", () => {
  it("labels its control with a real label", async () => {
    render(
      <Field label="Display name">
        <Input />
      </Field>
    );
    const input = screen.getByRole("textbox", { name: "Display name" });
    // Clicking the label focuses the control.
    await userEvent.click(screen.getByText("Display name"));
    expect(input).toHaveFocus();
  });

  it("makes the control required unless the field is optional", () => {
    render(
      <>
        <Field label="Display name">
          <Input />
        </Field>
        <Field label="Token name" optional>
          <Input />
        </Field>
      </>
    );
    const required = screen.getByRole("textbox", { name: "Display name" });
    expect(required).toBeRequired();
    expect(required).toHaveAttribute("aria-required", "true");

    const optional = screen.getByRole("textbox", {
      name: "Token name (optional)",
    });
    expect(optional).not.toBeRequired();
    expect(optional).not.toHaveAttribute("aria-required");
    expect(screen.getByText("(optional)")).toHaveClass("text-fg-subtle");
  });

  it("describes the control with its help text", () => {
    render(
      <Field label="Display name" help={HELP}>
        <Input />
      </Field>
    );
    const input = screen.getByRole("textbox");
    expect(input).toHaveAccessibleDescription(HELP);
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(screen.getByText(HELP)).toHaveClass("text-caption", "text-fg-muted");
  });

  it("shows an error with an icon, describes the control with it and marks it invalid", () => {
    render(
      <Field label="Display name" help={HELP} error="Enter a display name.">
        <Input />
      </Field>
    );
    const input = screen.getByRole("textbox", { name: "Display name" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(
      `${HELP} Error: Enter a display name.`
    );
    const message = screen.getByText("Enter a display name.").closest("p");
    expect(message).toHaveClass("text-danger-fg");
    expect(message?.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });

  it("lists only the descriptions that exist", () => {
    render(
      <Field label="Display name" error="Enter a display name.">
        <Input />
      </Field>
    );
    const ids = screen
      .getByRole("textbox")
      .getAttribute("aria-describedby")
      ?.split(" ");
    expect(ids).toHaveLength(1);
    expect(document.getElementById(ids?.[0] ?? "")).toHaveTextContent(
      "Enter a display name."
    );
  });

  it("gives every field its own ids, so many can share a page", () => {
    render(
      <>
        <Field label="One" help="First">
          <Input />
        </Field>
        <Field label="Two" help="Second">
          <Input />
        </Field>
      </>
    );
    const [one, two] = screen.getAllByRole("textbox");
    expect(one?.id).not.toBe(two?.id);
    expect(one).toHaveAccessibleDescription("First");
    expect(two).toHaveAccessibleDescription("Second");
  });

  it("uses an id from the parent when something else links to the field", () => {
    render(
      <Field label="Display name" id=":summary-target:">
        <Input />
      </Field>
    );
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "id",
      ":summary-target:"
    );
  });

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      render(
        <Field label="Display name" help={HELP} error="Enter a display name.">
          <Input />
        </Field>
      )
    );
  });
});
