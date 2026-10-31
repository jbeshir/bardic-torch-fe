import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CONTACT_FORM_URL, WIKI_HOME_URL } from "~/constants/navigation";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { HelpLinks } from "./HelpLinks";

/** The order and targets every template must show (DESIGN §5.7). */
const EXPECTED_HELP_LINKS = [
  ["Contact (external link)", CONTACT_FORM_URL],
  ["Help", "/help"],
  ["Licence & attribution", "/help/licence"],
  ["Original wiki (opens original wiki)", WIKI_HOME_URL],
];

describe("HelpLinks", () => {
  it("is Contact, Help, Licence & attribution, then the original wiki", async () => {
    await renderWithRouter(<HelpLinks />);
    const list = screen.getByRole("list", { name: "Help" });
    expect(
      within(list)
        .getAllByRole("link")
        .map(link => [link.textContent, link.getAttribute("href")])
    ).toEqual(EXPECTED_HELP_LINKS);
  });

  it("has four items, the separators hidden, each link 24 px tall", async () => {
    await renderWithRouter(<HelpLinks />);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveClass("inline-flex", "min-h-6");
    }
    const dots = [...document.querySelectorAll("li > span[aria-hidden]")];
    expect(dots.map(dot => dot.textContent)).toEqual(["·", "·", "·"]);
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(() => renderWithRouter(<HelpLinks />));
  });
});
