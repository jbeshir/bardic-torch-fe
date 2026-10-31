import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Index from "./_index";

describe("Index route", () => {
  it("renders the site name as the page heading", () => {
    render(<Index />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Bardic Torch" })
    ).toBeInTheDocument();
  });

  it("runs in the jsdom environment", () => {
    expect(typeof document).toBe("object");
  });
});
