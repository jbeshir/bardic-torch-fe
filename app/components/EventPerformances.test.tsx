import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EventPerformance } from "~/schemas/catalogue";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { EventPerformances } from "./EventPerformances";

const WREN = {
  slug: "wren-of-the-vale",
  name: "Wren of the Vale",
  kind: "community_bard",
  is_stub: false,
} as const;

const CAROL: EventPerformance = {
  piece: {
    slug: "midwinter-carol",
    title: "Midwinter Carol",
    kind: "song",
    secondary_kinds: [],
    conservation_status: "low_risk",
    is_stub: false,
  },
  link: {
    url: "https://video.example/carol",
    title: "Midwinter carol, sung",
    platform: "Videohall",
  },
  year: 2025,
  performers: [WREN, { ...WREN, slug: "dafydd", name: "Dafydd" }],
  description_verbatim: "The whole hall joined in.",
};

const HOARD: EventPerformance = {
  piece: {
    slug: "the-dragons-hoard",
    title: "The Dragon’s Hoard",
    kind: "poem",
    secondary_kinds: [],
    conservation_status: "restricted",
    is_stub: false,
  },
  // As the loader leaves it: emptied.
  link: { url: "", title: null, platform: null },
  year: null,
  performers: [],
  description_verbatim: "",
};

const NO_PIECE: EventPerformance = {
  ...CAROL,
  piece: null,
  link: { url: "https://video.example/open", title: null, platform: null },
  year: 2020,
};

const table = () =>
  screen.getByRole("table", { name: "Performances recorded here" });

describe("EventPerformances", () => {
  it("lists each performance: year, piece, performers and recording", async () => {
    await renderWithRouter(
      <EventPerformances performances={[CAROL, NO_PIECE]} total={2} />
    );
    const [, carol, open] = within(table()).getAllByRole("row");
    if (!carol || !open) throw new Error("rows missing");
    expect(carol).toHaveTextContent("2025");
    expect(
      within(carol).getByRole("link", { name: "Midwinter Carol" })
    ).toHaveAttribute("href", "/pieces/midwinter-carol");
    expect(within(carol).getByRole("link", { name: "Dafydd" })).toHaveAttribute(
      "href",
      "/bards/dafydd"
    );
    expect(carol).toHaveTextContent("Wren of the Vale, Dafydd");
    expect(
      within(carol).getByRole("link", { name: /Midwinter carol, sung/ })
    ).toHaveAttribute("rel", "nofollow ugc noopener");
    expect(carol).toHaveTextContent("(Videohall)");
    expect(open).toHaveTextContent("No particular piece");
    expect(
      within(open).getByRole("link", { name: /video\.example\/open/ })
    ).toBeInTheDocument();
  });

  it("names a restricted piece with no recording link, an unknown year last", async () => {
    await renderWithRouter(
      <EventPerformances performances={[HOARD]} total={1} />
    );
    const [, hoard] = within(table()).getAllByRole("row");
    if (!hoard) throw new Error("row missing");
    expect(
      within(hoard).getByRole("link", { name: "The Dragon’s Hoard" })
    ).toHaveAttribute("href", "/pieces/the-dragons-hoard");
    expect(hoard).toHaveTextContent("Link not shown: see the piece page");
    expect(hoard).toHaveTextContent("Unknown");
    expect(within(hoard).getAllByRole("link")).toHaveLength(1);
  });

  it("says how many more there are past the cap", async () => {
    await renderWithRouter(
      <EventPerformances performances={[CAROL]} total={203} />
    );
    expect(screen.getByText("and 202 more")).toBeVisible();
  });

  it("says when nothing is recorded", async () => {
    await renderWithRouter(<EventPerformances performances={[]} total={0} />);
    expect(
      screen.getByText("No performances recorded here yet.")
    ).toBeVisible();
  });

  it("renders the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(
        <EventPerformances performances={[CAROL, HOARD]} total={2} />
      )
    );
  });
});
