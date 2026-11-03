import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { ErrorSummary } from "./ErrorSummary";
import { Field } from "./Field";
import { Input } from "./Input";

function Form({
  problems,
  attempt = 1,
}: {
  problems: Parameters<typeof ErrorSummary>[0]["problems"];
  attempt?: number;
}) {
  return (
    <form>
      <ErrorSummary problems={problems} attempt={attempt} />
      <Field id="name" label="Display name" error="Enter a display name.">
        <Input name="name" />
      </Field>
      <Field id="token" label="Token name" error="Use up to 128 characters.">
        <Input name="token" />
      </Field>
    </form>
  );
}

const TWO = [
  { fieldId: "name", message: "Enter a display name." },
  { fieldId: "token", message: "Use up to 128 characters." },
] as const;

describe("ErrorSummary", () => {
  it("is an alert headed with the number of problems, linking to each field", () => {
    render(<Form problems={TWO} />);
    const summary = screen.getByRole("alert");
    expect(
      within(summary).getByRole("heading", {
        level: 2,
        name: "Error: Check 2 things below",
      })
    ).toBeInTheDocument();
    const links = within(summary).getAllByRole("link");
    expect(links.map(link => link.getAttribute("href"))).toEqual([
      "#name",
      "#token",
    ]);
    expect(links[0]).toHaveTextContent("Enter a display name.");
  });

  it("says 'thing' for one problem", () => {
    render(<Form problems={[TWO[0]]} />);
    expect(
      screen.getByRole("heading", { name: "Error: Check 1 thing below" })
    ).toBeInTheDocument();
  });

  it("takes focus when it appears, so the problems are read out", () => {
    render(<Form problems={TWO} />);
    expect(screen.getByRole("alert")).toHaveFocus();
  });

  it("moves focus again when the problems change or the form fails again, not on other renders", () => {
    const { rerender } = render(<Form problems={TWO} />);
    const name = screen.getByRole("textbox", { name: "Display name" });
    name.focus();
    rerender(<Form problems={[...TWO]} />);
    expect(name).toHaveFocus();
    rerender(<Form problems={[TWO[1]]} />);
    expect(screen.getByRole("alert")).toHaveFocus();
    // Submitted again with the same problem: focus and announce again.
    name.focus();
    rerender(<Form problems={[TWO[1]]} attempt={2} />);
    expect(screen.getByRole("alert")).toHaveFocus();
  });

  it("focuses the field a link points at, by mouse or keyboard", async () => {
    const user = userEvent.setup();
    render(<Form problems={TWO} />);
    await user.click(
      screen.getByRole("link", { name: "Use up to 128 characters." })
    );
    expect(screen.getByRole("textbox", { name: "Token name" })).toHaveFocus();
    screen.getByRole("alert").focus();
    await user.tab();
    expect(
      screen.getByRole("link", { name: "Enter a display name." })
    ).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("textbox", { name: "Display name" })).toHaveFocus();
  });

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(() => render(<Form problems={TWO} />));
  });
});
