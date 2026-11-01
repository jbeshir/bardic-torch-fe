import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HelpPage } from "~/components/HelpPage";
import {
  CONTACT_FORM_URL,
  NAV_GROUPS,
  wikiPageUrl,
} from "~/constants/navigation";
import { renderWithRouter } from "~/test/router";
import { findHelpPage, HELP_INDEX, type HelpContent } from "./pages";

/**
 * The help content itself (R24): every page's front matter, links, heading
 * order and credit, and the statements the new site's rules depend on.
 */

/** The help pages the site navigation lists. */
const NAV_HELP_PATHS = NAV_GROUPS.flatMap(({ items }) => items)
  .map(({ href }) => href)
  .filter(href => href.startsWith("/help/"));

const SLUGS = NAV_HELP_PATHS.map(path => path.replace("/help/", ""));

/** The original wiki's help and policy pages the help is adapted from. */
const WIKI_META_PAGES = [
  "Main Page",
  "Get Started Contributing",
  "Easy Start Add a Song",
  "Categories",
  "FAQ for Bards",
  "Bard Preference Checklist",
  "Conservation Status",
];

function page(slug: string): HelpContent {
  const content = findHelpPage(slug);
  if (!content) {
    throw new Error(`No help page "${slug}"`);
  }
  return content;
}

async function renderHelp(content: HelpContent) {
  await renderWithRouter(
    <main>
      <HelpPage content={content} />
    </main>,
    content.slug ? `/help/${content.slug}` : "/help"
  );
  return screen.getByRole("main");
}

/** The text of an h2's section: everything up to the next h2. */
function section(main: HTMLElement, name: string): string {
  const heading = within(main).getByRole("heading", { level: 2, name });
  const parts: string[] = [];
  for (
    let node = heading.nextElementSibling;
    node && node.tagName !== "H2";
    node = node.nextElementSibling
  ) {
    parts.push(node.textContent ?? "");
  }
  return parts.join(" ").replace(/\s+/g, " ");
}

/** The page's text, with the screen-reader link suffixes left out. */
function textOf(main: HTMLElement): string {
  const copy = main.cloneNode(true) as HTMLElement;
  copy.querySelectorAll(".sr-only").forEach(node => node.remove());
  return (copy.textContent ?? "").replace(/\s+/g, " ");
}

const ALL = [
  ["index", HELP_INDEX],
  ...SLUGS.map(slug => [slug, page(slug)] as const),
] as const;

describe.each(ALL)("help page %s", (slug, content) => {
  it("has front matter that describes it", () => {
    const { title, description, summary, sourcePages, lastReviewed } =
      content.frontmatter;
    expect(title).not.toMatch(/Bardic Torch$/);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(summary).toMatch(/\.$/);
    expect(Date.parse(lastReviewed)).toBeLessThanOrEqual(Date.now());
    if (slug === "index") {
      expect(sourcePages).toEqual([]);
    } else {
      expect(sourcePages.length).toBeGreaterThan(0);
      for (const source of sourcePages) {
        expect(WIKI_META_PAGES).toContain(source);
      }
    }
  });

  it("is titled by its front matter, with one h1", async () => {
    const main = await renderHelp(content);
    expect(within(main).getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(within(main).getByRole("heading", { level: 1 })).toHaveTextContent(
      content.frontmatter.title
    );
  });

  it("never skips a heading level", async () => {
    const main = await renderHelp(content);
    const levels = within(main)
      .getAllByRole("heading")
      .map(heading => Number(heading.tagName.slice(1)));
    expect(levels[0]).toBe(1);
    for (const [index, level] of levels.slice(1).entries()) {
      expect(level).toBeGreaterThanOrEqual(2);
      expect(level).toBeLessThanOrEqual((levels[index] ?? 1) + 1);
    }
    expect(Math.max(...levels)).toBeLessThanOrEqual(3);
  });

  it("links only over https, to the help pages, or to its own sections", async () => {
    const main = await renderHelp(content);
    const ids = new Set(
      [...main.querySelectorAll("[id]")].map(node => node.id)
    );
    for (const link of within(main).getAllByRole("link")) {
      const href = link.getAttribute("href") ?? "";
      const [path, hash] = href.split("#");
      if (/^[a-z]+:/i.test(href)) {
        expect(href).toMatch(/^https:\/\//);
      } else if (path === "" || path === `/help/${slug}`) {
        expect(ids).toContain(hash);
      } else {
        expect(["/help", ...NAV_HELP_PATHS]).toContain(path);
      }
    }
  });

  it("credits the original wiki page it came from, under CC BY-SA 4.0", async () => {
    const main = await renderHelp(content);
    const licence = within(main).getByText(/^This page is available under/);
    expect(
      within(licence).getByRole("link", { name: /CC BY-SA 4\.0/ })
    ).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by-sa/4.0/"
    );
    for (const source of content.frontmatter.sourcePages) {
      expect(
        within(licence).getByRole("link", { name: new RegExp(`‘${source}’`) })
      ).toHaveAttribute("href", wikiPageUrl(source));
    }
    if (content.frontmatter.sourcePages.length > 0) {
      expect(licence).toHaveTextContent(
        "on the original Bardic Torch wiki by its contributors."
      );
    }
  });

  it("follows the new rules and house style", async () => {
    const text = textOf(await renderHelp(content));
    // Links only: nothing suggests the site hosts words, files or recordings.
    expect(text).not.toMatch(
      /(lyrics|text|files?) (can|may) be (hosted|written|uploaded|added) (here|on)/i
    );
    expect(text).not.toMatch(/acceptable to write the lyrics/i);
    // The API gives no expiry or revocation (AMENDMENTS A1): help says nothing about tokens.
    expect(text).not.toMatch(/\btoken|expir/i);
    // British spelling, no exclamation marks.
    expect(text).not.toMatch(/\b(color|organization|favorite|catalog)\b/i);
    expect(text).not.toContain("!");
  });
});

describe("the help pages", () => {
  it("are every page the navigation lists, and no unknown slug", () => {
    expect(SLUGS).toEqual([
      "contributing",
      "faq-for-bards",
      "bard-preference-checklist",
      "conservation-status",
      "licence",
    ]);
    expect(findHelpPage("lyrics")).toBeNull();
    expect(findHelpPage(undefined)).toBeNull();
  });
});

describe("the help index", () => {
  it("has a card for every help page, by its title, in the navigation's order", async () => {
    const main = await renderHelp(HELP_INDEX);
    const cards = within(main)
      .getAllByRole("heading", { level: 3 })
      .map(card => card.textContent);
    expect(cards).toEqual(SLUGS.map(slug => page(slug).frontmatter.title));
  });
});

describe("contributing guide", () => {
  it("says links only: no lyrics or text ever, no uploads", async () => {
    const main = await renderHelp(page("contributing"));
    expect(section(main, "Our principles")).toContain(
      "Links only. Bardic Torch is an index, not an archive. We never host lyrics or the text of a work, not even public-domain or Creative Commons text. We don't accept uploads of files, audio or video."
    );
    expect(
      within(main).getByRole("complementary", { name: "At a glance" })
    ).toHaveTextContent("Never lyrics, files, audio or video.");
  });

  it("needs a public source for every licensing and etiquette claim, even from the bard", async () => {
    const main = await renderHelp(page("contributing"));
    expect(section(main, "Our principles")).toContain(
      "Any statement about permissions, licences or a bard's wishes needs a link to a public page where the creator said it. This applies even if you are the bard"
    );
  });

  it("says every contributor's edit is moderated, and moderators' own are recorded", async () => {
    const main = await renderHelp(page("contributing"));
    const review = section(main, "How review works");
    expect(review).toContain(
      "Every edit from a contributor waits for a moderator before it goes live."
    );
    expect(review).toContain(
      "Moderators' own edits go live straight away, but they are recorded in the page history like everyone else's."
    );
    expect(
      within(main).getByRole("complementary", { name: "At a glance" })
    ).toHaveTextContent(
      "a moderator checks every contributor's edit before it goes live."
    );
  });

  it("gives the category naming conventions", async () => {
    const main = await renderHelp(page("contributing"));
    const naming = within(main).getByRole("heading", {
      level: 3,
      name: "Naming a new term",
    });
    const rules = naming.nextElementSibling?.textContent ?? "";
    expect(rules).toContain(
      "Use natural English and capitalise the content words: Green Eggs & Ham"
    );
    expect(rules).toContain("The only punctuation allowed is ( ), ' and &.");
    expect(rules).toContain("Welsh (Language)");
    expect(rules).toContain("Every new term needs a parent");
    expect(section(main, "Categories and naming")).toContain(
      'Please don\'t use "filk"'
    );
  });

  it("keeps legal names out unless the bard publishes them, and hidden until checked", async () => {
    const main = await renderHelp(page("contributing"));
    expect(section(main, "Credits")).toContain(
      "Only add a legal or mundane name if the bard publishes it themselves. Even then, it stays hidden until a moderator has checked it."
    );
  });

  it("says the catalogue isn't here yet, linking to the original wiki", async () => {
    const main = await renderHelp(page("contributing"));
    const note = within(main).getByText(/^Information:/).parentElement;
    expect(note).toHaveTextContent("The catalogue is on its way.");
    expect(
      within(note as HTMLElement).getByRole("link", {
        name: "original Bardic Torch wiki (opens original wiki)",
      })
    ).toHaveAttribute("href", wikiPageUrl("Category:Pieces"));
  });
});

describe("FAQ for bards", () => {
  it("explains opting out: a public, permanent statement that's clearly yours, sent through the form", async () => {
    const main = await renderHelp(page("faq-for-bards"));
    const optOut = section(main, "What if I don't want a page?");
    expect(optOut).toContain("That's your choice, and we'll respect it.");
    expect(optOut).toContain(
      "the page must be public, permanent and clearly yours"
    );
    expect(optOut).toContain(
      "Your page then becomes a short stub that shows only your cited statement."
    );
    expect(optOut).toContain(
      "nobody can create a new page for you under a matching name"
    );
    const heading = within(main).getByRole("heading", {
      level: 2,
      name: "What if I don't want a page?",
    });
    const list = heading.parentElement?.querySelector(`#${heading.id} ~ ol`);
    expect(
      within(list as HTMLElement).getByRole("link", {
        name: "contact form (external link)",
      })
    ).toHaveAttribute("href", CONTACT_FORM_URL);
    expect(
      within(list as HTMLElement).getByRole("link", { name: "above" })
    ).toHaveAttribute(
      "href",
      "/help/faq-for-bards#why-cant-i-just-tell-you-im-the-bard"
    );
  });

  it("says a bard's own word needs a public source too", async () => {
    const main = await renderHelp(page("faq-for-bards"));
    expect(section(main, "Why can't I just tell you I'm the bard?")).toContain(
      "every statement about licensing, permissions or etiquette needs a link to a public page where you said it. This applies to you too"
    );
  });

  it("never hosts or uploads works, and says removing a link doesn't take content down", async () => {
    const main = await renderHelp(page("faq-for-bards"));
    expect(section(main, "Can I upload my work to Bardic Torch?")).toMatch(
      /^No\. We don't host any works, including yours/
    );
    expect(section(main, "Is Bardic Torch violating my copyright?")).toContain(
      "We never host lyrics, text, audio or video, and nobody can upload files."
    );
    expect(
      section(main, "Someone links to a copy of my work that I didn't allow")
    ).toContain("removing our link doesn't take the content down");
  });

  it("says bards' edits are moderated like everyone's", async () => {
    const main = await renderHelp(page("faq-for-bards"));
    expect(section(main, "Can I edit my own page?")).toContain(
      "Like everyone's, your edits are checked by a moderator before they go live."
    );
  });
});

describe("bard preference checklist", () => {
  it("covers the checklist's eight sections, in order", async () => {
    const main = await renderHelp(page("bard-preference-checklist"));
    const covers = within(main).getByRole("heading", {
      level: 2,
      name: "What the checklist covers",
    });
    const sections = within(main)
      .getAllByRole("heading", { level: 3 })
      .filter(
        heading =>
          covers.compareDocumentPosition(heading) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
      .map(heading => heading.textContent);
    expect(sections).toEqual([
      "1. Licensing and copyright",
      "2. Performance permission",
      "3. Adaptations",
      "4. Attribution",
      "5. Commercial use",
      "6. Recording and writing down",
      "7. Performance etiquette",
      "8. Objectionable use",
    ]);
  });

  it("asks bards to publish their preferences themselves, linking the full list on the wiki", async () => {
    const main = await renderHelp(page("bard-preference-checklist"));
    expect(section(main, "What it is")).toContain(
      "publish it on your own website, blog or album page and send us the link"
    );
    expect(section(main, "What it is")).toContain(
      "We can't host your preferences as original text, because we can't check who wrote them."
    );
    expect(
      within(main).getByRole("link", {
        name: "full checklist from the original wiki (opens original wiki)",
      })
    ).toHaveAttribute("href", wikiPageUrl("Bard Preference Checklist"));
  });

  it("says the etiquette card comes with the catalogue, every point sourced", async () => {
    const main = await renderHelp(page("bard-preference-checklist"));
    const showing = section(
      main,
      "How Bardic Torch will show your preferences"
    );
    expect(showing).toContain("Coming with the catalogue.");
    expect(showing).toContain("Every point links to its source");
    expect(showing).toContain("Piece-level rules win.");
  });
});

describe("conservation status", () => {
  it("makes exactly three places Endangered, and four Low Risk", async () => {
    const main = await renderHelp(page("conservation-status"));
    const rows = within(within(main).getByRole("table")).getAllByRole("row");
    const meaning = (status: string) =>
      rows.find(row => row.firstElementChild?.textContent === status)
        ?.lastElementChild?.textContent;
    expect(meaning("Low Risk")).toBe(
      "The work exists in at least 4 known places."
    );
    expect(meaning("Endangered")).toBe(
      "The work exists in 3 or fewer known places, and isn't Restricted."
    );
    expect(meaning("Restricted")).toContain(
      "This overrides every other status."
    );
    expect(
      within(main).getByText(/^Information:/).parentElement
    ).toHaveTextContent(
      "Exactly 3 places now counts as Endangered. The original wiki defined Low Risk as at least 4 places and Endangered as fewer than 3, which left exactly 3 undecided."
    );
    expect(textOf(main)).not.toMatch(/Endangered: found in fewer than 3/);
  });

  it("lists the five statuses at a glance, each linking to its section", async () => {
    const main = await renderHelp(page("conservation-status"));
    const glance = within(main).getByRole("complementary", {
      name: "At a glance",
    });
    const links = within(glance).getAllByRole("link");
    expect(links.map(link => link.textContent)).toEqual([
      "Low Risk",
      "Endangered",
      "Critically Endangered",
      "Restricted",
      "Unassessed",
    ]);
    expect(links[1]).toHaveAttribute(
      "href",
      "/help/conservation-status#the-statuses"
    );
    expect(links[3]).toHaveAttribute(
      "href",
      "/help/conservation-status#how-restricted-works"
    );
    expect(within(glance).getAllByRole("definition")[1]).toHaveTextContent(
      "found in 3 places or fewer."
    );
  });

  it("has moderators confirm statuses the site suggests from live places", async () => {
    const main = await renderHelp(page("conservation-status"));
    const setting = section(main, "How a status is set");
    expect(setting).toContain(
      "counting the distinct places among a piece's links that are still working"
    );
    expect(setting).toContain("A moderator confirms it.");
  });

  it("puts Restricted above everything, with no preservation prompts", async () => {
    const main = await renderHelp(page("conservation-status"));
    const restricted = section(main, "How Restricted works");
    expect(restricted).toContain(
      "A Restricted piece is never marked Endangered or Critically Endangered"
    );
    expect(restricted).toContain('No "help preserve" prompts.');
    expect(restricted).toContain("It needs a source.");
    expect(section(main, "How you can help")).toContain(
      "and the creator's wishes allow it"
    );
  });
});

describe("licence & attribution", () => {
  it("licenses the site's text under CC BY-SA 4.0, and not the linked works", async () => {
    const main = await renderHelp(page("licence"));
    const licence = section(main, "Our licence");
    expect(licence).toContain(
      "The text on Bardic Torch is available under the Creative Commons Attribution-ShareAlike 4.0 International licence"
    );
    expect(
      within(main).getByRole("link", {
        name: "Creative Commons Attribution-ShareAlike 4.0 International licence (external link)",
      })
    ).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by-sa/4.0/"
    );
    expect(section(main, "What the licence doesn't cover")).toContain(
      "Our CC BY-SA licence gives you no rights in the works themselves."
    );
  });

  it("credits the original wiki's contributors and links to the old wiki", async () => {
    const main = await renderHelp(page("licence"));
    expect(section(main, "Thank you")).toContain(
      "Thank you to every editor who added a bard, a piece, a link or a category."
    );
    expect(
      within(main).getByRole("link", {
        name: "original wiki's list of users (opens original wiki)",
      })
    ).toHaveAttribute("href", wikiPageUrl("Special:ListUsers"));
    expect(
      within(main).getByRole("link", {
        name: "bardictorch.miraheze.org (opens original wiki)",
      })
    ).toHaveAttribute("href", "https://bardictorch.miraheze.org");
    expect(section(main, "Where our text came from")).toContain(
      "The original wiki stays online where it is, with its full page histories."
    );
  });

  it("carries the fixed non-affiliation statement and the link takedown route", async () => {
    const main = await renderHelp(page("licence"));
    expect(section(main, "Not an official site")).toContain(
      "Bardic Torch is community-maintained and not affiliated with the Society for Creative Anachronism or any other organisation."
    );
    expect(section(main, "Questions and takedowns")).toContain(
      "We can remove or hide a link, but the content will stay online wherever it is hosted."
    );
    expect(section(main, "Your contributions")).toContain(
      "Never paste in lyrics, the text of a work, or someone else's writing."
    );
  });
});
