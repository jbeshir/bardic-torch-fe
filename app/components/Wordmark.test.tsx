import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Wordmark } from "./Wordmark";

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
});

describe.each(["light", "dark"])("Wordmark (%s theme)", theme => {
  it("names its parent with its text, not the mark", () => {
    document.documentElement.dataset.theme = theme;
    render(
      <h1>
        <Wordmark />
      </h1>
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Bardic Torch" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("works as the accessible name of a home link", () => {
    document.documentElement.dataset.theme = theme;
    render(
      <a href="/">
        <Wordmark />
      </a>
    );
    expect(screen.getByRole("link", { name: "Bardic Torch" })).toHaveAttribute(
      "href",
      "/"
    );
  });
});

describe("Wordmark", () => {
  it("sets 'Torch' in the accent text colour and the rest in ink", () => {
    const { container } = render(<Wordmark />);
    expect(screen.getByText("Torch")).toHaveClass("text-accent-text");
    const wordmark = container.firstElementChild;
    expect(wordmark).toHaveClass("font-display", "text-wordmark", "text-fg");
    expect(wordmark?.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });
});
