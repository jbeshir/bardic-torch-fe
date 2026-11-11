import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "~/test/router";
import { Disclosure } from "./Disclosure";

describe("Disclosure", () => {
  it("is closed, a focusable summary that opens it", async () => {
    const user = userEvent.setup();
    await renderWithRouter(
      <Disclosure summary="Status history (2)">
        <p>The entries.</p>
      </Disclosure>
    );
    const summary = screen.getByText("Status history (2)");
    const details = summary.closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(screen.getByText("The entries.")).not.toBeVisible();
    await user.tab();
    expect(summary).toHaveFocus();
    await user.click(summary);
    expect(details).toHaveAttribute("open");
    expect(screen.getByText("The entries.")).toBeVisible();
  });
});
