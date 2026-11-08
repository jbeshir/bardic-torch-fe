import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { LicenceLine } from "./LicenceLine";

describe("LicenceLine (plan §4.0)", () => {
  it("names the site's text licence and credits the page history", async () => {
    await renderWithRouter(
      <p>
        <LicenceLine historyPath="/categories/swords/history" />
      </p>
    );
    expect(document.body).toHaveTextContent(
      "Text is available under the Creative Commons Attribution-ShareAlike 4.0 (external link) licence. This page may be adapted from the original Bardic Torch wiki; its contributors are credited in the page history."
    );
    expect(
      screen.getByRole("link", {
        name: /Creative Commons Attribution-ShareAlike 4.0/,
      })
    ).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by-sa/4.0/"
    );
    expect(screen.getByRole("link", { name: "page history" })).toHaveAttribute(
      "href",
      "/categories/swords/history"
    );
  });

  it("renders the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(<LicenceLine historyPath="/events/x/history" />)
    );
  });
});
