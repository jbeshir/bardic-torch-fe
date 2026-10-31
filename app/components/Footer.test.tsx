import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LICENCE_URL } from "~/constants/navigation";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { Footer } from "./Footer";

describe("Footer", () => {
  it("is the contentinfo landmark with the licence, the non-affiliation statement and the help links", async () => {
    await renderWithRouter(<Footer />);
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent(
      "Bardic Torch: an index of bardic pieces, kept by the community."
    );
    expect(
      within(footer).getByRole("link", {
        name: "Creative Commons Attribution-ShareAlike 4.0 (external link)",
      })
    ).toHaveAttribute("href", LICENCE_URL);
    expect(footer).toHaveTextContent(
      "Text is available under the Creative Commons Attribution-ShareAlike 4.0 (external link) licence."
    );
    expect(footer).toHaveTextContent(
      "Bardic Torch is community-maintained and not affiliated with the Society for Creative Anachronism or any other organisation."
    );
    expect(within(footer).getByRole("list", { name: "Help" })).toBeVisible();
  });

  it("shows the mark as decoration only", async () => {
    await renderWithRouter(<Footer />);
    expect(
      screen.getByRole("contentinfo").querySelector("svg")
    ).toHaveAttribute("aria-hidden", "true");
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(() => renderWithRouter(<Footer />));
  });
});
