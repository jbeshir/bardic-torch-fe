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

  it("has the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      render(<ResultsStatus>Showing 1 piece</ResultsStatus>)
    );
  });
});
