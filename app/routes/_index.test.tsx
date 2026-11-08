import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { SEARCH } from "~/constants/navigation";
import { renderRoutes } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import Index, { meta } from "./_index";

const HEADLINE = "Find the songs, stories and poems of the bardic community.";

type Data = Awaited<ReturnType<typeof import("./_index").loader>>;

const LOADED: Data = {
  totals: { pieces: 142, people: 61 },
  kinds: [
    { kind: "song", count: 120 },
    { kind: "poem", count: 1 },
  ],
  topTerms: [
    { label: "Mood: Warlike", to: "/categories/warlike" },
    { label: "Topic: Swords", to: "/categories/swords" },
  ],
};

function renderHome(data: Data = LOADED, url = "/") {
  return renderRoutes(
    [
      {
        path: "/",
        loader: () => data,
        Component: Index,
        HydrateFallback: () => null,
      },
      { path: "/pieces", Component: () => <p>Pieces page</p> },
    ],
    url
  );
}

describe("Index route", () => {
  it("leads with the hero: the mark, the headline as the h1 and what the site does", async () => {
    await renderHome();
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

  it("has Browse pieces as the primary action and How to contribute as the secondary", async () => {
    const router = await renderHome();
    const [browse, contribute] = screen
      .getAllByRole("link")
      .filter(link => link.closest(".bg-hero"));
    expect(browse).toHaveAccessibleName("Browse pieces");
    expect(browse).toHaveAttribute("href", "/pieces");
    expect(browse).toHaveClass("bg-accent");
    expect(contribute).toHaveAccessibleName("How to contribute");
    expect(contribute).toHaveAttribute("href", "/help/contributing");
    expect(router.state.location.pathname).toBe("/");
  });

  it("no longer promises the catalogue, or names the original wiki", async () => {
    await renderHome();
    const container = document.body;
    expect(container).not.toHaveTextContent(/moving here soon|on its way/i);
    expect(container).not.toHaveTextContent(/original wiki/i);
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).not.toMatch(/^https?:/);
    }
  });

  it("searches the catalogue from the hero", async () => {
    await renderHome();
    const search = screen.getByRole("search");
    expect(search).toHaveAttribute("action", SEARCH.action);
    expect(search).toHaveAttribute("method", "get");
    expect(
      within(search).getByRole("searchbox", { name: "Search the catalogue" })
    ).toHaveAttribute("name", SEARCH.param);
  });

  it("counts the catalogue under the search", async () => {
    await renderHome();
    expect(
      screen.getByText("142 pieces and 61 people and groups so far")
    ).toBeVisible();
  });

  it("uses the singular for one piece and one person or group", async () => {
    await renderHome({ ...LOADED, totals: { pieces: 1, people: 1 } });
    expect(
      screen.getByText("1 piece and 1 person or group so far")
    ).toBeVisible();
  });

  it("leaves the counts out and says so when they didn't load", async () => {
    await renderHome({ ...LOADED, totals: null, kinds: null });
    expect(screen.queryByText(/so far/)).not.toBeInTheDocument();
    const explore = screen.getByRole("region", { name: "Start exploring" });
    expect(
      within(explore).getByText("We couldn’t load the catalogue’s counts")
    ).toBeVisible();
    expect(
      within(explore).getByRole("button", { name: "Try again" })
    ).toBeVisible();
    // The way in is still there.
    expect(
      within(explore).getByRole("link", { name: "All categories" })
    ).toBeVisible();
  });

  it("explains the mission: an index, links only, keeping works alive, anyone can contribute", async () => {
    await renderHome();
    const why = screen.getByRole("region", { name: "Why Bardic Torch" });
    const cards = within(why)
      .getAllByRole("listitem")
      .filter(card => card.querySelector("h3") !== null);
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
      "Editing is not open yet: it arrives in a later release. Until then, send us the link to where a work lives, and once editing opens a moderator will review every edit before it goes live."
    );
  });

  it("offers the kinds with their counts, and the top moods and topics, as internal chips", async () => {
    await renderHome();
    const explore = screen.getByRole("region", { name: "Start exploring" });
    const chips = within(explore).getAllByRole("link");
    expect(chips.map(chip => chip.textContent)).toEqual([
      "Song (120)",
      "Poem (1)",
      "Mood: Warlike",
      "Topic: Swords",
      "All categories",
      "Collections",
      "Events and venues",
    ]);
    expect(chips.map(chip => chip.getAttribute("href"))).toEqual([
      "/pieces?kind=song",
      "/pieces?kind=poem",
      "/categories/warlike",
      "/categories/swords",
      "/categories",
      "/collections",
      "/events",
    ]);
    expect(within(explore).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the kinds and says the categories didn't load when the terms failed", async () => {
    await renderHome({ ...LOADED, topTerms: null });
    const explore = screen.getByRole("region", { name: "Start exploring" });
    expect(
      within(explore).getByText("We couldn’t load the categories")
    ).toBeVisible();
    expect(
      within(explore).getByRole("link", { name: "Song (120)" })
    ).toBeVisible();
    // The counts line is a separate region and stays.
    expect(screen.getByText(/142 pieces and 61 people/)).toBeVisible();
  });

  it("lets the keyboard reach Try again", async () => {
    await renderHome({ ...LOADED, topTerms: null });
    const user = userEvent.setup();
    const retry = screen.getByRole("button", { name: "Try again" });
    await user.tab();
    let tabs = 0;
    while (document.activeElement !== retry && tabs++ < 40) await user.tab();
    expect(retry).toHaveFocus();
  });

  it("follows Browse pieces to /pieces", async () => {
    const router = await renderHome();
    await userEvent
      .setup()
      .click(screen.getByRole("link", { name: "Browse pieces" }));
    expect(router.state.location.pathname).toBe("/pieces");
  });

  it("links a browse-by-status line after each of three static badges", async () => {
    await renderHome();
    const card = screen
      .getByRole("heading", { name: "Every version, everywhere" })
      .closest("li") as HTMLElement;
    expect(
      within(card)
        .getAllByRole("link")
        .map(link => [link.textContent, link.getAttribute("href")])
    ).toEqual([
      ["How conservation statuses work", "/help/conservation-status"],
      ["Browse endangered pieces", "/pieces?status=endangered"],
      [
        "Browse critically endangered pieces",
        "/pieces?status=critically_endangered",
      ],
      ["Browse low-risk pieces", "/pieces?status=low_risk"],
    ]);
    // The badges are not links (the link variant goes to the help page).
    expect(within(card).getByText("Endangered")).not.toHaveAttribute("href");
    expect(
      within(card).getByText("Critically endangered").closest("a")
    ).toBeNull();
    expect(within(card).getByText("Low risk").closest("a")).toBeNull();
  });

  it("speaks to bards, links their help pages and says it isn't affiliated", async () => {
    await renderHome();
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
    await renderHome();
    expect(
      screen.getByText(/^The name has two meanings: a torch to search by/)
    ).toHaveClass("text-caption", "text-fg-subtle");
  });

  it("orders its headings h1, then h2s, with the cards as h3s", async () => {
    await renderHome();
    expect(
      screen.getAllByRole("heading").map(heading => heading.tagName)
    ).toEqual(["H1", "H2", "H3", "H3", "H3", "H2", "H2"]);
  });

  it("is titled Bardic Torch, with the site's description and its canonical address", () => {
    const tags = meta({
      matches: [
        {
          id: "root",
          pathname: "/",
          loaderData: { siteOrigin: "https://bardictorch.example" },
          params: {},
          meta: [],
        },
      ],
    } as unknown as Parameters<typeof meta>[0]);
    expect(tags).toContainEqual({ title: "Bardic Torch" });
    expect(tags).toContainEqual({
      tagName: "link",
      rel: "canonical",
      href: "https://bardictorch.example/",
    });
    expect(tags).toContainEqual({
      property: "og:title",
      content: "Bardic Torch",
    });
    expect(tags).toContainEqual({ property: "og:type", content: "website" });
    expect(tags).not.toContainEqual(
      expect.objectContaining({ name: "robots" })
    );
    expect(tags).toContainEqual({
      name: "description",
      content:
        "A community index of SCA bardic songs, stories and poems and the bards who made them, so they can be found, sung and passed on.",
    });
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(() => renderHome());
  });
});
