import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { linkOf, performanceOf, WREN } from "~/test/catalogue";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { Performances, performancesOf } from "./Performances";

const BARDS = {
  slug: "northmarch-bards",
  name: "Northmarch Bards",
  kind: "group",
  is_stub: false,
} as const;
const ALDITH = {
  slug: "aldith-of-ashdown",
  name: "Aldith of Ashdown",
  kind: "community_bard",
  is_stub: false,
} as const;

const LINKS = [
  linkOf({
    url: "https://video.example/hearth",
    title: "At the hearth",
    performances: [
      performanceOf({ year: null, description_verbatim: "Undated" }),
      performanceOf({
        year: 2024,
        description_verbatim: "A lively take",
        uploader: "Pennon Tapper",
        event: {
          slug: "the-copper-hearth",
          name: "The Copper Hearth",
          kind: "venue",
        },
        performers: [WREN, BARDS],
      }),
    ],
  }),
  linkOf({
    url: "https://video.example/revel",
    performances: [
      performanceOf({
        year: 2026,
        description_verbatim: "Newest",
        performers: [WREN, ALDITH, BARDS],
      }),
    ],
  }),
];

describe("performancesOf", () => {
  it("puts the newest year first and unknown years last", () => {
    expect(performancesOf(LINKS).map(p => p.year)).toEqual([2026, 2024, null]);
  });

  it("is empty for links that record none", () => {
    expect(performancesOf([linkOf()])).toEqual([]);
  });
});

describe("Performances", () => {
  it("is a table of every performance, newest first", async () => {
    await renderWithRouter(<Performances links={LINKS} />);
    const table = screen.getByRole("table");
    expect(table).toHaveClass("hidden", "md:table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map(header => header.textContent)
    ).toEqual(["Year", "Performers", "Event", "Recording", "Uploaded by"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map(row => row.firstElementChild?.textContent)).toEqual([
      "2026",
      "2024",
      "Year unknown",
    ]);
    const middle = rows[1] as HTMLElement;
    expect(middle).toHaveTextContent("Wren of the Vale and Northmarch Bards");
    expect(
      within(middle).getByRole("link", { name: "Wren of the Vale" })
    ).toHaveAttribute("href", "/bards/wren-of-the-vale");
    expect(
      within(middle).getByRole("link", { name: "The Copper Hearth" })
    ).toHaveAttribute("href", "/events/the-copper-hearth");
    const recording = within(middle).getByRole("link", {
      name: "At the hearth (external link)",
    });
    expect(recording).toHaveAttribute("href", "https://video.example/hearth");
    expect(recording).toHaveAttribute("rel", "nofollow ugc noopener");
    expect(middle).toHaveTextContent("As described: A lively take");
    expect(within(middle).getByText("A lively take").tagName).toBe("Q");
    expect(middle).toHaveTextContent("Pennon Tapper");
    expect(rows[0]).toHaveTextContent(
      "Wren of the Vale, Aldith of Ashdown and Northmarch Bards"
    );
  });

  it("is a card per performance below md, in the same order", async () => {
    await renderWithRouter(<Performances links={LINKS} />);
    const cards = screen
      .getAllByRole("list")
      .find(list => list.classList.contains("md:hidden"));
    const items = within(cards as HTMLElement).getAllByRole("listitem");
    expect(items.map(item => item.firstElementChild?.textContent)).toEqual([
      "2026",
      "2024",
      "Year unknown",
    ]);
    expect(items[1]).toHaveTextContent("At The Copper Hearth");
    expect(items[1]).toHaveTextContent("Uploaded by Pennon Tapper");
    // A recording without a title is named by its address's host.
    expect(items[0]).toHaveTextContent("video.example");
  });

  it("is nothing when no link records a performance", async () => {
    await renderWithRouter(
      <div data-testid="where">
        <Performances links={[linkOf()]} />
      </div>
    );
    expect(screen.getByTestId("where")).toBeEmptyDOMElement();
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(<Performances links={LINKS} />)
    );
  });
});
