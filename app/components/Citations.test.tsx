import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CollectionCitation } from "~/schemas/catalogue";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { Citations } from "./Citations";

const KETTLE: CollectionCitation = {
  piece: {
    slug: "the-copper-kettle",
    title: "The Copper Kettle",
    kind: "song",
    secondary_kinds: [],
    conservation_status: "endangered",
    is_stub: false,
  },
  person: null,
  url: "https://songs.example/kettle",
  title: "The Copper Kettle, with chords",
  locator: "p. 14",
  roles: ["lyrics", "sheet_music"],
};

const HOARD: CollectionCitation = {
  piece: {
    slug: "the-dragons-hoard",
    title: "The Dragon’s Hoard",
    kind: "poem",
    secondary_kinds: [],
    conservation_status: "restricted",
    is_stub: false,
  },
  person: null,
  url: "https://private.example/hoard",
  title: "The text",
  locator: null,
  roles: [],
};

const BARDS: CollectionCitation = {
  piece: null,
  person: {
    slug: "northmarch-bards",
    name: "Northmarch Bards",
    kind: "group",
    is_stub: false,
  },
  url: "https://songs.example/bards",
  title: null,
  locator: "p. 2",
  roles: ["website"],
};

const table = () => screen.getByRole("table", { name: "Citations" });

describe("Citations", () => {
  it("lists each piece or bard with its link, place and roles", async () => {
    await renderWithRouter(<Citations citations={[KETTLE, BARDS]} total={2} />);
    const [, kettle, bards] = within(table()).getAllByRole("row");
    if (!kettle || !bards) throw new Error("rows missing");
    expect(
      within(kettle).getByRole("link", { name: "The Copper Kettle" })
    ).toHaveAttribute("href", "/pieces/the-copper-kettle");
    expect(
      within(kettle).getByRole("link", { name: /with chords/ })
    ).toHaveAttribute("rel", "nofollow ugc noopener");
    expect(kettle).toHaveTextContent("p. 14");
    expect(kettle).toHaveTextContent("Lyrics, Sheet music");
    expect(
      within(bards).getByRole("link", { name: "Northmarch Bards" })
    ).toHaveAttribute("href", "/bards/northmarch-bards");
    // No title: the URL is the link's text.
    expect(
      within(bards).getByRole("link", { name: /songs\.example\/bards/ })
    ).toBeInTheDocument();
    expect(bards).toHaveTextContent("Group");
  });

  it("names a restricted piece but never links its URL", async () => {
    await renderWithRouter(<Citations citations={[HOARD]} total={1} />);
    const [, hoard] = within(table()).getAllByRole("row");
    if (!hoard) throw new Error("row missing");
    expect(
      within(hoard).getByRole("link", { name: "The Dragon’s Hoard" })
    ).toHaveAttribute("href", "/pieces/the-dragons-hoard");
    expect(hoard).toHaveTextContent("Link not shown: see the piece page");
    expect(hoard).toHaveTextContent("Restricted");
    expect(document.body.innerHTML).not.toContain("private.example");
  });

  it("says how many more there are past the cap", async () => {
    await renderWithRouter(<Citations citations={[KETTLE]} total={1206} />);
    expect(screen.getByText("and 1,205 more")).toBeVisible();
  });

  it("says when nothing is cited", async () => {
    await renderWithRouter(<Citations citations={[]} total={0} />);
    expect(
      screen.getByText("Nothing cited from this collection yet.")
    ).toBeVisible();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("renders the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(<Citations citations={[KETTLE, HOARD]} total={2} />)
    );
  });
});
