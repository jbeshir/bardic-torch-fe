import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { Radio } from "./Radio";

function Group() {
  return (
    <fieldset>
      <legend>Page state</legend>
      <Radio name="stub" value="" label="All pages" defaultChecked />
      <Radio name="stub" value="true" label="Stubs only" />
      <Radio name="stub" value="false" label="Hide stubs" />
    </fieldset>
  );
}

describe("Radio", () => {
  it("is a native radio named by its label", () => {
    render(<Group />);
    const radio = screen.getByRole("radio", { name: "Stubs only" });
    expect(radio).toHaveAttribute("type", "radio");
    expect(radio).toHaveAttribute("name", "stub");
    expect(screen.getByRole("radio", { name: "All pages" })).toBeChecked();
  });

  it("is chosen by a click anywhere on its row, and moved with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Group />);
    await user.click(screen.getByText("Stubs only"));
    const stubs = screen.getByRole("radio", { name: "Stubs only" });
    expect(stubs).toBeChecked();
    expect(stubs).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Hide stubs" })).toBeChecked();
    expect(stubs).not.toBeChecked();
  });

  it("draws the ring from tokens, with the accent dot when chosen, and hands over to the system in forced colours", () => {
    render(<Radio name="x" label="One" defaultChecked />);
    const radio = screen.getByRole("radio");
    expect(radio).toHaveClass(
      "appearance-none",
      "rounded-full",
      "border-2",
      "border-border-strong",
      "checked:border-accent",
      "forced-colors:appearance-auto"
    );
    const dot = radio.nextElementSibling;
    expect(dot).toHaveAttribute("aria-hidden", "true");
    expect(dot).toHaveClass(
      "hidden",
      "peer-checked:block",
      "bg-accent",
      "forced-colors:hidden!"
    );
  });

  it("has a 44 px row below lg", () => {
    render(<Radio name="x" label="One" />);
    expect(screen.getByText("One").closest("label")).toHaveClass(
      "py-2.5",
      "lg:py-1"
    );
  });

  it("has the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() => render(<Group />));
  });
});
