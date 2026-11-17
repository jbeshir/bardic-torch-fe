import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PieceBody } from "~/components/piece/PiecePage";
import { DOCUMENT_SCHEMAS } from "~/editing/documents";
import { renderWithRouter } from "~/test/router";
import { previewPiece } from "./preview.server";

describe("the piece preview", () => {
  it("renders the read page's credits and links from the document", async () => {
    const document = DOCUMENT_SCHEMAS.piece.parse({
      title: "The Copper Kettle",
      credits: [{ person_slug: "wren-of-the-vale", role: "tune" }],
      links: [
        {
          url: "https://example.org/kettle",
          title: "The words, from the songbook",
          roles: ["lyrics"],
        },
      ],
    });
    const view = previewPiece(document, {
      persons: [{ value: "wren-of-the-vale", label: "Wren of the Vale" }],
    });
    await renderWithRouter(<PieceBody view={view} />);

    expect(
      screen.getByRole("link", { name: "Wren of the Vale" })
    ).toHaveAttribute("href", "/bards/wren-of-the-vale");
    const links = screen.getByRole("region", { name: "Where to find it" });
    expect(
      within(links).getByRole("link", { name: /^The words, from the songbook/ })
    ).toHaveAttribute("href", "https://example.org/kettle");
  });
});
