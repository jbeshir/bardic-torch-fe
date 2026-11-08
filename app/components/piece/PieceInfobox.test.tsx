import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { creditOf, pieceOf, termOf } from "~/test/catalogue";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import type { Piece } from "~/schemas/catalogue";
import { PieceInfobox } from "./PieceInfobox";

// The piece page's facts box: every row in every state (plan §4.5).

const render = (piece: Piece) =>
  renderWithRouter(<PieceInfobox piece={piece} />);

const box = () =>
  screen.getByRole("complementary", { name: "About this piece" });

/** The value cell (dd) of the row labelled `label`. */
function value(label: string, index = 0) {
  const term = within(box()).getAllByText(label, { selector: "dt" })[index];
  return term?.nextElementSibling as HTMLElement;
}

describe("PieceInfobox", () => {
  it("says what the piece is, with its secondary kinds", async () => {
    await render(pieceOf({ secondary_kinds: ["dance_music", "instrumental"] }));
    expect(value("Kind")).toHaveTextContent(
      "Songalso: Dance music, Instrumental"
    );
  });

  it.each([
    [1580, 1600, "1580–1600"],
    [1580, null, "from 1580"],
    [null, 1600, "until 1600"],
  ] as const)("shows the period %s–%s as %s", async (start, end, period) => {
    await render(pieceOf({ period_start: start, period_end: end }));
    expect(value("Period")).toHaveTextContent(period);
  });

  it("leaves the period, other names and origin out when there are none", async () => {
    await render(pieceOf());
    for (const label of ["Period", "Also known as", "Origin"]) {
      expect(within(box()).queryByText(label, { selector: "dt" })).toBeNull();
    }
  });

  it("lists other names with their kind, never the redirects", async () => {
    await render(
      pieceOf({
        aliases: [
          { text: "The Kettle Song", kind: "alt_title" },
          { text: "Old Copper", kind: "nickname" },
          { text: "A Tavern Favourite", kind: "subtitle" },
          { text: "Copper Kettle (Ashdown)", kind: "redirect" },
        ],
      })
    );
    const names = within(value("Also known as")).getAllByRole("listitem");
    expect(names.map(name => name.textContent)).toEqual([
      "The Kettle Song (alternative title)",
      "Old Copper (nickname)",
      "A Tavern Favourite (subtitle)",
    ]);
  });

  it("credits a named person with a link to their page, by role and part", async () => {
    await render(
      pieceOf({
        credits: [
          creditOf({ role: "tune", part: "tune", note: "Arranged for three." }),
        ],
      })
    );
    const credit = value("Tune (tune)");
    expect(
      within(credit).getByRole("link", { name: "Wren of the Vale" })
    ).toHaveAttribute("href", "/bards/wren-of-the-vale");
    expect(within(credit).getByText("Arranged for three.")).toHaveClass(
      "text-caption"
    );
  });

  it.each([
    ["traditional", "Traditional"],
    ["unknown", "Unknown"],
    ["anonymous", "Anonymous"],
    ["various", "Various"],
  ] as const)(
    "credits %s as “%s”, with no link",
    async (attribution, label) => {
      await render(
        pieceOf({ credits: [creditOf({ attribution, person: null })] })
      );
      expect(value("Words")).toHaveTextContent(label);
      expect(within(value("Words")).queryByRole("link")).toBeNull();
    }
  );

  it.each([
    ["probable", "(probably)"],
    ["possible", "(possibly)"],
    ["disputed", "(disputed)"],
  ] as const)("qualifies a %s credit %s", async (certainty, words) => {
    await render(pieceOf({ credits: [creditOf({ certainty })] }));
    expect(value("Words")).toHaveTextContent(`Wren of the Vale ${words}`);
    // Disputed has the warning triangle too, never the icon alone.
    expect(
      value("Words").querySelector("svg.tabler-icon-alert-triangle") !== null
    ).toBe(certainty === "disputed");
  });

  it("keeps two credits with the same role apart, in order", async () => {
    await render(
      pieceOf({
        credits: [
          creditOf({ part: "verses" }),
          creditOf({ attribution: "traditional", person: null }),
          creditOf({
            role: "arrangement",
            attribution: "various",
            person: null,
          }),
        ],
      })
    );
    expect(
      within(box())
        .getAllByRole("term")
        .map(term => term.textContent)
    ).toEqual([
      "Kind",
      "Words (verses)",
      "Words",
      "Arrangement",
      "Conservation",
      "Licensing",
    ]);
    expect(value("Words")).toHaveTextContent("Traditional");
  });

  it("shows no credits as the empty value, never “unknown author”", async () => {
    await render(pieceOf({ credits: [] }));
    expect(value("Credits")).toHaveTextContent("—Not recorded");
    expect(screen.getByText("Not recorded")).toHaveClass("sr-only");
    expect(value("Credits")).not.toHaveTextContent(/unknown/i);
    expect(box()).not.toHaveTextContent(/unknown author/i);
  });

  it("lists the origin as chips, the main source first and marked, the others with their part", async () => {
    await render(
      pieceOf({
        terms: [
          termOf("joyful", "mood", "Joyful"),
          termOf("16th-century", "origin", "16th Century", { part: "tune" }),
          termOf("pre-1600-sources", "origin", "Pre-1600 sources", {
            is_primary: true,
            part: "words",
          }),
        ],
      })
    );
    const chips = within(value("Origin")).getAllByRole("link");
    expect(chips.map(chip => chip.textContent)).toEqual([
      "Words: Pre-1600 sources (main source)",
      "Tune: 16th Century",
    ]);
    expect(chips[1]).toHaveAttribute("href", "/categories/16th-century");
  });

  it.each([
    "unassessed",
    "low_risk",
    "endangered",
    "critically_endangered",
    "restricted",
  ] as const)(
    "links the %s badge to its entry on the help page",
    async status => {
      await render(pieceOf({ conservation_status: status }));
      const badge = within(value("Conservation")).getByRole("link", {
        name: /^Conservation status: /,
      });
      expect(badge.getAttribute("href")).toMatch(
        /^\/help\/conservation-status#[a-z-]+$/
      );
    }
  );

  it("names the badge link for the status", async () => {
    await render(pieceOf({ conservation_status: "endangered" }));
    expect(
      screen.getByRole("link", { name: "Conservation status: Endangered" })
    ).toHaveAttribute("href", "/help/conservation-status#endangered");
  });

  it("keeps the status history closed under the badge, oldest first, next in the Tab order", async () => {
    await render(
      pieceOf({
        conservation_history: [
          {
            conservation_status: "unassessed",
            reason: "Imported from the old wiki.",
            source_url: null,
            at: "2025-01-10T12:00:00Z",
          },
          {
            conservation_status: "endangered",
            reason: "Known to only a few singers.",
            source_url: "https://assessments.example/kettle",
            at: "2026-02-01T12:00:00Z",
          },
        ],
      })
    );
    const summary = screen.getByText("Status history (2)");
    const details = summary.closest("details");
    expect(details).not.toHaveAttribute("open");
    // The badge, then the summary (a native disclosure: Enter and Space
    // open it in a browser; jsdom only implements the click).
    await userEvent.tab();
    expect(document.activeElement).toHaveAccessibleName(
      "Conservation status: Endangered"
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(summary);
    await userEvent.click(summary);
    expect(details).toHaveAttribute("open");
    const entries = within(details as HTMLElement).getAllByRole("listitem");
    expect(entries[0]).toHaveTextContent(
      "10 Jan 2025Conservation status: Not yet assessedImported from the old wiki."
    );
    expect(within(entries[0] as HTMLElement).queryByRole("link")).toBeNull();
    expect(within(entries[1] as HTMLElement).getByRole("time")).toHaveAttribute(
      "datetime",
      "2026-02-01T12:00:00Z"
    );
    const source = within(entries[1] as HTMLElement).getByRole("link", {
      name: "Source (external link)",
    });
    expect(source).toHaveAttribute(
      "href",
      "https://assessments.example/kettle"
    );
    expect(source).toHaveAttribute("rel", "nofollow ugc noopener");
  });

  it("shows a source that isn't a web address as nothing to follow", async () => {
    await render(
      pieceOf({
        conservation_history: [
          {
            conservation_status: "endangered",
            reason: "Few know it.",
            source_url: "javascript:alert(1)",
            at: "2026-02-01T12:00:00Z",
          },
        ],
      })
    );
    expect(screen.queryByRole("link", { name: /Source/ })).toBeNull();
  });

  it("has no status history without entries", async () => {
    await render(pieceOf());
    expect(screen.queryByText(/Status history/)).toBeNull();
  });

  it("is the same markup in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      render(
        pieceOf({
          credits: [creditOf({ certainty: "disputed" })],
          terms: [termOf("16th-century", "origin", "16th Century")],
        })
      )
    );
  });
});

describe("PieceInfobox licensing row (C4.4)", () => {
  it.each([
    ["known", "cc_by_sa", "Known: CC BY-SA"],
    ["known", "cc_by_nc_nd", "Known: CC BY-NC-ND"],
    ["known", "pd", "Known"],
    ["known", "arr", "Known"],
    ["known", null, "Known"],
    ["unknown", null, "Unknown"],
  ] as const)(
    "sums up %s licensing with %s as “%s”, linked to the card",
    async (status, licence, summary) => {
      await render(pieceOf({ licensing_status: status, licence }));
      const link = within(value("Licensing")).getByRole("link");
      expect(link).toHaveTextContent(summary);
      expect(link).toHaveAttribute("href", "/#licensing");
      // Never a version.
      expect(link.textContent).not.toMatch(/\d/);
    }
  );
});
