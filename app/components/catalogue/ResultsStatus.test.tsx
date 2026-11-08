import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { ResultsStatus } from "./ResultsStatus";

describe("ResultsStatus", () => {
  it("is a polite status region out of sight", () => {
    render(<ResultsStatus>Showing 12 pieces</ResultsStatus>);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Showing 12 pieces");
    expect(status).toHaveClass("sr-only");
  });

  it("says when there is nothing", () => {
    render(<ResultsStatus>No results</ResultsStatus>);
    expect(screen.getByRole("status")).toHaveTextContent("No results");
  });

  it("shows the count when visible, as muted small text", () => {
    render(<ResultsStatus visible>Showing 51–100 of 249 pieces</ResultsStatus>);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Showing 51–100 of 249 pieces");
    expect(status).not.toHaveClass("sr-only");
    expect(status).toHaveClass("text-body-sm", "text-fg-muted", "tabular-nums");
  });

  it("says a note after the count without showing it", () => {
    render(
      <ResultsStatus visible note="That affiliation no longer exists">
        Showing 3 bards
      </ResultsStatus>
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(
      "Showing 3 bards. That affiliation no longer exists"
    );
    expect(screen.getByText(". That affiliation no longer exists")).toHaveClass(
      "sr-only"
    );
  });

  it("has the same markup in both themes, hidden and visible", async () => {
    await expectSameMarkupInBothThemes(() =>
      render(<ResultsStatus>Showing 1 piece</ResultsStatus>)
    );
    await expectSameMarkupInBothThemes(() =>
      render(
        <ResultsStatus visible note="Some categories were left out">
          Showing 1 piece
        </ResultsStatus>
      )
    );
  });
});
