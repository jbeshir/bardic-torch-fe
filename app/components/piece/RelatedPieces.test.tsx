import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Piece } from "~/schemas/catalogue";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { RelatedPieces } from "./RelatedPieces";

type Relation = Piece["relations"][number];

const relation = (
  type: Relation["type"],
  direction: Relation["direction"],
  slug: string
): Relation => ({
  type,
  direction,
  piece: {
    slug,
    title: slug.replace(/-/g, " "),
    kind: "song",
    secondary_kinds: [],
    conservation_status: "low_risk",
    is_stub: false,
  },
});

describe("RelatedPieces", () => {
  it.each([
    ["variant_of", "outgoing", "Variant of"],
    ["variant_of", "incoming", "Variants"],
    ["contrafactum_of", "outgoing", "Contrafactum of"],
    ["contrafactum_of", "incoming", "Contrafacta"],
    ["setting_of", "outgoing", "Setting of"],
    ["setting_of", "incoming", "Settings"],
    ["same_text_other_form", "outgoing", "Same text in another form"],
    ["same_text_other_form", "incoming", "Same text in another form"],
  ] as const)("reads %s %s as “%s”", async (type, direction, label) => {
    await renderWithRouter(
      <RelatedPieces relations={[relation(type, direction, "the-other")]} />
    );
    const group = screen.getByRole("region", { name: label });
    expect(
      within(group).getByRole("link", { name: "the other" })
    ).toHaveAttribute("href", "/pieces/the-other");
  });

  it("groups by label in the API's order, both directions of a text in another form together", async () => {
    await renderWithRouter(
      <RelatedPieces
        relations={[
          relation("variant_of", "outgoing", "a"),
          relation("same_text_other_form", "outgoing", "b"),
          relation("variant_of", "incoming", "c"),
          relation("variant_of", "incoming", "d"),
          relation("same_text_other_form", "incoming", "e"),
        ]}
      />
    );
    expect(
      screen.getAllByRole("heading", { level: 3 }).map(h => h.textContent)
    ).toEqual(["Variant of", "Same text in another form", "Variants"]);
    expect(
      within(screen.getByRole("region", { name: "Variants" })).getAllByRole(
        "link"
      )
    ).toHaveLength(2);
    expect(
      within(
        screen.getByRole("region", { name: "Same text in another form" })
      ).getAllByRole("link")
    ).toHaveLength(2);
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(
        <RelatedPieces relations={[relation("setting_of", "incoming", "x")]} />
      )
    );
  });
});
