import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";

function NoTokens({ headingLevel = 3 }: { headingLevel?: 2 | 3 }) {
  return (
    <EmptyState
      title="No tokens yet"
      headingLevel={headingLevel}
      action={<Button variant="primary">Create token</Button>}
    >
      Create a token to let tools like an MCP client work with Bardic Torch for
      you.
    </EmptyState>
  );
}

describe("EmptyState", () => {
  it("is a section named by its heading, with the body and one action", () => {
    render(<NoTokens />);
    const section = screen.getByRole("region", { name: "No tokens yet" });
    expect(
      screen.getByRole("heading", { level: 3, name: "No tokens yet" })
    ).toBeInTheDocument();
    expect(section).toHaveTextContent(/Create a token to let tools/);
    expect(screen.getByRole("button", { name: "Create token" })).toBeVisible();
  });

  it("is not a live region", () => {
    render(<NoTokens />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the unlit torch as decoration, centred", () => {
    render(<NoTokens />);
    const section = screen.getByRole("region");
    expect(section).toHaveClass("text-center", "mx-auto", "max-w-md", "py-12");
    const art = section.querySelector("svg");
    expect(art).toHaveAttribute("aria-hidden", "true");
    expect(art).toHaveClass("h-12", "w-12");
  });

  it("can use an h2 where it heads the page's own section", () => {
    render(<NoTokens headingLevel={2} />);
    expect(
      screen.getByRole("heading", { level: 2, name: "No tokens yet" })
    ).toBeInTheDocument();
  });

  it("gives each empty state its own heading id", () => {
    render(
      <>
        <NoTokens />
        <NoTokens />
      </>
    );
    const [first, second] = screen.getAllByRole("region");
    expect(first?.getAttribute("aria-labelledby")).not.toBe(
      second?.getAttribute("aria-labelledby")
    );
  });

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(() => render(<NoTokens />));
  });
});
