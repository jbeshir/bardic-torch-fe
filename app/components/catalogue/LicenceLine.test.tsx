import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { LicenceLine } from "./LicenceLine";

describe("LicenceLine", () => {
  it("names the site's text licence and credits the wiki's contributors in the page history", async () => {
    await renderWithRouter(
      <p>
        <LicenceLine historyPath="/pieces/the-copper-kettle/history" />
      </p>
    );
    expect(screen.getByRole("paragraph")).toHaveTextContent(
      "Text is available under the Creative Commons Attribution-ShareAlike 4.0 (external link) licence. This page may be adapted from the original Bardic Torch wiki; its contributors are credited in the page history."
    );
    const licence = screen.getByRole("link", {
      name: "Creative Commons Attribution-ShareAlike 4.0 (external link)",
    });
    expect(licence).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by-sa/4.0/"
    );
    expect(screen.getByRole("link", { name: "page history" })).toHaveAttribute(
      "href",
      "/pieces/the-copper-kettle/history"
    );
  });

  it("ends at the wiki on a page with no history to show", async () => {
    await renderWithRouter(
      <p>
        <LicenceLine />
      </p>
    );
    expect(screen.getByRole("paragraph")).toHaveTextContent(
      /adapted from the original Bardic Torch wiki\.$/
    );
    expect(screen.queryByRole("link", { name: "page history" })).toBeNull();
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(<LicenceLine historyPath="/bards/wren/history" />)
    );
  });
});
