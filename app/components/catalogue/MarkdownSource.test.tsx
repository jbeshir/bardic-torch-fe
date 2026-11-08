import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { MarkdownSource } from "./MarkdownSource";

describe("MarkdownSource", () => {
  it("shows each block as a paragraph of plain text, line breaks kept", () => {
    const { container } = render(
      <MarkdownSource
        text={"Meets *monthly*.\n\n- Open floor\n- All welcome\n \n\n"}
      />
    );
    const paragraphs = container.querySelectorAll("p");
    expect([...paragraphs].map(p => p.textContent)).toEqual([
      "Meets *monthly*.",
      "- Open floor\n- All welcome",
    ]);
    expect(paragraphs[1]).toHaveClass("whitespace-pre-line");
  });

  it("never makes HTML or links of the text", () => {
    render(
      <MarkdownSource
        text={'<a href="javascript:x">x</a> [y](https://e.example)'}
      />
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(
      screen.getByText('<a href="javascript:x">x</a> [y](https://e.example)')
    ).toBeInTheDocument();
  });

  it("keeps a repeated paragraph", () => {
    const { container } = render(<MarkdownSource text={"Again\n\nAgain"} />);
    expect(container.querySelectorAll("p")).toHaveLength(2);
  });

  it("renders the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      render(<MarkdownSource text={"One\n\nTwo"} />)
    );
  });
});
