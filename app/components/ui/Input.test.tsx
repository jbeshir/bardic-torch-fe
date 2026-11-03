import { IconSearch } from "@tabler/icons-react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { Field } from "./Field";
import { Input } from "./Input";

describe("Input", () => {
  it("is a 44 px text control on the input background", () => {
    render(<Input aria-label="Display name" />);
    const input = screen.getByRole("textbox", { name: "Display name" });
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveClass(
      "min-h-11",
      "bg-input-bg",
      "border-border-strong",
      "hover:border-fg-subtle",
      "placeholder:text-fg-subtle",
      "text-fg"
    );
  });

  it("takes the type it is given", () => {
    render(<Input aria-label="Email" type="email" autoComplete="email" />);
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute(
      "type",
      "email"
    );
  });

  it("accepts typing", async () => {
    render(<Input aria-label="Display name" />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "Iolo");
    expect(input).toHaveValue("Iolo");
  });

  it("is reached by Tab", async () => {
    render(<Input aria-label="Display name" />);
    await userEvent.tab();
    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  it("shows the disabled tokens and can't be typed into", async () => {
    render(<Input aria-label="Display name" disabled defaultValue="Iolo" />);
    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
    expect(input).toHaveClass(
      "disabled:bg-input-bg-locked",
      "disabled:text-fg-subtle",
      "disabled:border-border"
    );
    await userEvent.type(input, "x");
    expect(input).toHaveValue("Iolo");
  });

  it("is locked when read-only: its own fill in both themes, a dashed strong border", () => {
    render(<Input aria-label="New token value" readOnly value="bt_abc" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("readonly");
    expect(input).toHaveClass(
      "bg-input-bg-locked",
      "border-dashed",
      "border-border-strong"
    );
    expect(input).not.toHaveClass("bg-input-bg");
  });

  it("gets a 2 px danger edge without moving in the error state", () => {
    render(
      <Field label="Display name" error="Enter a display name.">
        <Input />
      </Field>
    );
    expect(screen.getByRole("textbox")).toHaveClass(
      "border",
      "border-danger-icon",
      "ring-1",
      "ring-inset",
      "ring-danger-icon"
    );
  });

  it("makes room for a decorative leading icon", () => {
    render(<Input aria-label="Search" type="search" icon={IconSearch} />);
    const input = screen.getByRole("searchbox", { name: "Search" });
    expect(input).toHaveClass("pl-10");
    const icon = input.parentElement?.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveClass("text-fg-subtle", "pointer-events-none");
  });

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      render(
        <>
          <Input aria-label="Name" placeholder="Your name" />
          <Input aria-label="Search" type="search" icon={IconSearch} />
        </>
      )
    );
  });
});
