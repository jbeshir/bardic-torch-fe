import { screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FACETS, wikiPageUrl, WIKI_SEARCH } from "~/constants/navigation";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import Index, { meta } from "./_index";

const HEADLINE = "Find the songs, stories and poems of the bardic community.";

describe("Index route", () => {
  it("leads with the hero: the mark, the headline as the h1 and what the site does", async () => {
    await renderWithRouter(<Index />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent(HEADLINE);
    expect(h1).toHaveClass("text-display");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const lead = screen.getByText(
      /We gather the bardic community’s scattered songbooks/
    );
    // Where things live, never "find lyrics": the site only links.
    expect(lead).toHaveTextContent(
      /^Bardic Torch helps bards find where a piece’s words, music, history, context and etiquette live,/
    );
    expect(lead).not.toHaveTextContent(/lyrics/);
    expect(h1.parentElement).toHaveClass("bg-hero", "rounded-xl");
  });

  it("has the primary action on this site and the wiki as the secondary", async () => {
    const router = await renderWithRouter(<Index />);
    const [contribute, browse] = screen
      .getAllByRole("link")
      .filter(link => link.closest(".bg-hero"));
    expect(contribute).toHaveAccessibleName("How to contribute");
    expect(contribute).toHaveAttribute("href", "/help/contributing");
    expect(contribute).toHaveClass("bg-accent");
    // The visible label starts the accessible name (WCAG 2.5.3).
    expect(browse).toHaveAccessibleName(
      "Browse on the original wiki (opens original wiki)"
    );
    expect(browse).toHaveAttribute("href", wikiPageUrl("Category:Pieces"));
    expect(router.state.location.pathname).toBe("/");
  });

  it("says the catalogue isn't here yet, and searches the original wiki", async () => {
    await renderWithRouter(<Index />);
    expect(
      screen.getByText(/The catalogue is moving here soon\./)
    ).toBeInTheDocument();
    expect(screen.getByRole("search")).toHaveAttribute(
      "action",
      WIKI_SEARCH.action
    );
  });

  it("explains the mission: an index, links only, keeping works alive, anyone can contribute", async () => {
    await renderWithRouter(<Index />);
    const why = screen.getByRole("region", { name: "Why Bardic Torch" });
    const cards = within(why).getAllByRole("listitem");
    expect(
      cards.map(
        card => within(card).getByRole("heading", { level: 3 }).textContent
      )
    ).toEqual([
      "An index, not an archive",
      "Every version, everywhere",
      "Anyone can contribute",
    ]);
    expect(cards[0]).toHaveTextContent(
      "We never host lyrics, recordings or video: every piece points to where it already lives, and to its creator’s wishes about sharing."
    );
    expect(
      within(cards[1] as HTMLElement).getByRole("link", {
        name: "How conservation statuses work",
      })
    ).toHaveAttribute("href", "/help/conservation-status");
    expect(cards[2]).toHaveTextContent(
      "a moderator will review it before it goes live"
    );
  });

  it("offers every facet as a chip to the original wiki", async () => {
    await renderWithRouter(<Index />);
    const explore = screen.getByRole("region", {
      name: "Start exploring on the original wiki",
    });
    const chips = within(explore).getAllByRole("link");
    expect(chips.map(chip => chip.getAttribute("href"))).toEqual(
      FACETS.map(({ href }) => href)
    );
    expect(chips[0]).toHaveAccessibleName("Genre / kind (opens original wiki)");
  });

  it("speaks to bards, links their help pages and says it isn't affiliated", async () => {
    await renderWithRouter(<Index />);
    const bards = screen.getByRole("region", { name: "For bards" });
    expect(bards).toHaveTextContent("or to ask not to have one.");
    expect(
      within(bards).getByRole("link", { name: "FAQ for bards" })
    ).toHaveAttribute("href", "/help/faq-for-bards");
    expect(
      within(bards).getByRole("link", { name: "Bard preference checklist" })
    ).toHaveAttribute("href", "/help/bard-preference-checklist");
    expect(
      within(bards).getByText(/^Information:/).parentElement
    ).toHaveTextContent(
      "Information: Bardic Torch is community-maintained and not affiliated with the Society for Creative Anachronism or any other organisation."
    );
  });

  it("ends with the name note", async () => {
    await renderWithRouter(<Index />);
    expect(
      screen.getByText(/^The name has two meanings: a torch to search by/)
    ).toHaveClass("text-caption", "text-fg-subtle");
  });

  it("orders its headings h1, then h2s, with the cards as h3s", async () => {
    await renderWithRouter(<Index />);
    expect(
      screen.getAllByRole("heading").map(heading => heading.tagName)
    ).toEqual(["H1", "H2", "H3", "H3", "H3", "H2", "H2"]);
  });

  it("is titled Bardic Torch, with the site's description", () => {
    const tags = meta({} as Parameters<typeof meta>[0]);
    expect(tags).toContainEqual({ title: "Bardic Torch" });
    expect(tags).toContainEqual({
      name: "description",
      content:
        "A community index of SCA bardic songs, stories and poems and the bards who made them, so they can be found, sung and passed on.",
    });
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(() => renderWithRouter(<Index />));
  });
});
