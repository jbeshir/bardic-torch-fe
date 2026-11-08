import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DiffRow as Row } from "~/catalogue/diff";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { DiffRow } from "./DiffRow";

const SCALAR: Row = {
  field: "kind",
  label: "Kind",
  diff: {
    kind: "scalar",
    before: null,
    after: [
      { kind: "text", text: "Poem" },
      { kind: "internal", to: "/categories/war", text: "War" },
    ],
  },
};

const TEXT: Row = {
  field: "notes_md",
  label: "Notes",
  diff: {
    kind: "text",
    before: "Old *notes*.",
    after: "New notes.",
    words: null,
  },
};

const LIST: Row = {
  field: "links",
  label: "Links",
  diff: {
    kind: "list",
    added: [
      {
        key: "a",
        parts: [{ kind: "external", url: "https://a.example", text: "A site" }],
      },
    ],
    removed: [{ key: "b", parts: [{ kind: "text", text: "b.example" }] }],
    changed: [
      {
        before: { key: "c", parts: [{ kind: "text", text: "Lyrics" }] },
        after: { key: "c", parts: [{ kind: "text", text: "Lyrics, Text" }] },
      },
    ],
  },
};

describe("DiffRow", () => {
  it("shows a scalar before and after, with — for none", async () => {
    await renderWithRouter(<DiffRow row={SCALAR} first={false} />);
    const section = screen.getByRole("region", { name: "Kind" });
    const [before, after] = within(section).getAllByRole("definition");
    expect(before).toHaveTextContent("—");
    expect(after).toHaveTextContent("Poem · War");
    expect(within(section).getByRole("link", { name: "War" })).toHaveAttribute(
      "href",
      "/categories/war"
    );
  });

  it("shows a text field as two blocks of its source", async () => {
    await renderWithRouter(<DiffRow row={TEXT} first={false} />);
    expect(screen.getByText("Old *notes*.")).toBeVisible();
    expect(screen.getByText("New notes.")).toBeVisible();
    expect(screen.getAllByRole("term").map(t => t.textContent)).toEqual([
      "Before",
      "After",
    ]);
  });

  it("marks a text field word by word, never by colour alone", async () => {
    await renderWithRouter(
      <DiffRow
        row={{
          ...TEXT,
          diff: {
            kind: "text",
            before: "Old *notes*.",
            after: "New notes.",
            words: [
              { kind: "removed", text: "Old *notes*." },
              { kind: "added", text: "New notes." },
            ],
          },
        }}
        first={false}
      />
    );
    const removed = document.querySelector("del");
    const added = document.querySelector("ins");
    expect(removed).toHaveTextContent("removed: Old *notes*.");
    expect(removed).toHaveClass("line-through");
    expect(added).toHaveTextContent("added: New notes.");
    expect(screen.queryByText("Before")).toBeNull();
  });

  it("marks list items added, removed and changed with an icon and a word", async () => {
    await renderWithRouter(<DiffRow row={LIST} first={false} />);
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map(item => item.textContent)).toEqual([
      "AddedA site (external link)",
      "Removedb.example",
      "ChangedLyrics → , now Lyrics, Text",
    ]);
    expect(screen.getByRole("link", { name: /A site/ })).toHaveAttribute(
      "rel",
      "nofollow ugc noopener"
    );
  });

  it("shows only the value with no base", async () => {
    await renderWithRouter(<DiffRow row={SCALAR} first />);
    expect(screen.queryByText("Before")).toBeNull();
    expect(screen.getByText(/Poem/)).toBeVisible();
    await renderWithRouter(<DiffRow row={LIST} first />);
    expect(screen.getAllByRole("link", { name: /A site/ })[0]).toBeVisible();
    expect(screen.queryByText("Added")).toBeNull();
  });

  it("renders the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(<DiffRow row={LIST} first={false} />)
    );
  });
});
