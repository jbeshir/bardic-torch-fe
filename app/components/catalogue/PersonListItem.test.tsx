import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PersonSummary } from "~/schemas/catalogue";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { PersonListItem } from "./PersonListItem";

const wren: PersonSummary = {
  slug: "wren-of-the-vale",
  name: "Wren of the Vale",
  kind: "community_bard",
  is_stub: false,
};

function renderItem(person: PersonSummary) {
  return renderWithRouter(
    <ul role="list">
      <PersonListItem person={person} />
    </ul>
  );
}

describe("PersonListItem", () => {
  it("links the name to the bard's page and says their kind", async () => {
    await renderItem(wren);
    const item = screen.getByRole("listitem");
    expect(
      within(item).getByRole("link", { name: "Wren of the Vale" })
    ).toHaveAttribute("href", "/bards/wren-of-the-vale");
    expect(item).toHaveTextContent("Community bard");
    expect(item).not.toHaveTextContent("Stub");
  });

  it("says Stub for a stub, and names a group", async () => {
    await renderItem({ ...wren, kind: "group", is_stub: true });
    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("Group");
    expect(item).toHaveTextContent("Stub");
  });

  it("renders the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() => renderItem(wren));
  });
});
