import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PieceSummary } from "~/schemas/catalogue";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { PieceListItem } from "./PieceListItem";

const kettle: PieceSummary = {
  slug: "the-copper-kettle",
  title: "The Copper Kettle",
  kind: "song",
  secondary_kinds: ["dance_music"],
  conservation_status: "endangered",
  is_stub: false,
};

function renderItem(piece: PieceSummary) {
  return renderWithRouter(
    <ul role="list">
      <PieceListItem piece={piece} />
    </ul>
  );
}

describe("PieceListItem", () => {
  it("links the title to the piece's page and lists its kinds", async () => {
    await renderItem(kettle);
    const item = screen.getByRole("listitem");
    expect(
      within(item).getByRole("link", { name: "The Copper Kettle" })
    ).toHaveAttribute("href", "/pieces/the-copper-kettle");
    expect(item).toHaveTextContent("Song · Dance music");
    expect(item).toHaveTextContent("Conservation status: Endangered");
    expect(item).not.toHaveTextContent("Stub");
  });

  it("leaves out the status while it is unassessed, and says Stub", async () => {
    await renderItem({
      ...kettle,
      secondary_kinds: [],
      conservation_status: "unassessed",
      is_stub: true,
    });
    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("Song");
    expect(item).not.toHaveTextContent("Not yet assessed");
    expect(item).toHaveTextContent("Stub");
  });

  it("shows a restricted piece's badge and only its own page's link", async () => {
    await renderItem({ ...kettle, conservation_status: "restricted" });
    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("Conservation status: Restricted");
    expect(within(item).getAllByRole("link")).toHaveLength(1);
  });

  it("is reached with the keyboard", async () => {
    await renderItem(kettle);
    const link = screen.getByRole("link", { name: "The Copper Kettle" });
    link.focus();
    expect(link).toHaveFocus();
  });

  it("has the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() => renderItem(kettle));
  });
});
