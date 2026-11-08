import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { compileMarkdown, FRONTMATTER } from "~/test/markdown";
import { renderWithRouter } from "~/test/router";
import { MarkdownPart } from "./components";

type Slot = Parameters<typeof MarkdownPart>[0]["slot"];

async function renderSlot(body: string, slot: Slot = "intro") {
  const { page } = await compileMarkdown(`${FRONTMATTER}\n${body}`);
  await renderWithRouter(
    <div data-testid="slot">
      <MarkdownPart page={page} slot={slot} />
    </div>,
    "/help/test"
  );
  return screen.getByTestId("slot");
}

const INFOBOX = `:::infobox{title="At a glance"}

- **Who it's for:** anyone who writes.
- [Low Risk](#the-statuses): found in at least 4 places.

:::
`;

describe("front matter", () => {
  it("is exported as `frontmatter`", async () => {
    const { frontmatter } = await compileMarkdown(`${FRONTMATTER}\nText.`);
    expect(frontmatter).toEqual({
      title: "Test page",
      description: "A page written by a test.",
      summary: "What a test page is for.",
      sourcePages: ["Main Page"],
      lastReviewed: "2026-10-31",
    });
  });

  it("fails the build when it is missing", async () => {
    await expect(compileMarkdown("## Heading\n\nText.")).rejects.toThrow(
      /has no front matter/
    );
  });

  it("fails the build when it breaks the schema, naming the field", async () => {
    const broken = FRONTMATTER.replace(
      "description: A page written by a test.",
      `description: ${"x".repeat(161)}`
    );
    await expect(compileMarkdown(`${broken}\nText.`)).rejects.toThrow(
      /invalid front matter:\n- description:/
    );
  });
});

describe("directives", () => {
  it("renders :::note as an info Alert in the prose, its paragraph as the body", async () => {
    const slot = await renderSlot(
      ":::note\n\n**Exactly 3** places counts.\n\n:::\n"
    );
    const alert = slot.querySelector(".bg-info-bg");
    expect(alert).toHaveTextContent("Information: Exactly 3 places counts.");
    expect(alert?.parentElement).toHaveClass("my-6");
    expect(alert?.querySelector("p")).toBeNull();
    expect(within(alert as HTMLElement).getByText("Exactly 3").tagName).toBe(
      "STRONG"
    );
  });

  it("renders :::warning as a warning Alert", async () => {
    const slot = await renderSlot(":::warning\n\nCareful.\n\n:::\n");
    expect(slot.querySelector(".bg-warning-bg")).toHaveTextContent(
      "Warning: Careful."
    );
  });

  it("keeps the paragraphs of a note with more than one", async () => {
    const slot = await renderSlot(":::note\n\nOne.\n\nTwo.\n\n:::\n");
    expect(slot.querySelectorAll(".bg-info-bg p")).toHaveLength(2);
  });

  it("renders :::infobox as the Infobox, its items as label and value", async () => {
    const slot = await renderSlot(INFOBOX, "infobox");
    const aside = within(slot).getByRole("complementary", {
      name: "At a glance",
    });
    const terms = within(aside).getAllByRole("term");
    expect(terms.map(term => term.textContent)).toEqual([
      "Who it's for",
      "Low Risk",
    ]);
    expect(
      within(aside)
        .getAllByRole("definition")
        .map(value => value.textContent)
    ).toEqual(["anyone who writes.", "found in at least 4 places."]);
    // Infobox links are standalone links, not prose links (DESIGN §6.10).
    expect(within(aside).getByRole("link", { name: "Low Risk" })).toHaveClass(
      "font-medium",
      "no-underline"
    );
  });

  it("renders :::cards as a list of link cards", async () => {
    const slot = await renderSlot(
      ":::cards\n\n- [Licence](/help/licence): How to reuse our text.\n- [FAQ](/help/faq-for-bards): Answers.\n\n:::\n"
    );
    const list = within(slot).getByRole("list");
    const cards = within(list).getAllByRole("listitem");
    expect(cards).toHaveLength(2);
    expect(
      within(cards[0] as HTMLElement).getByRole("heading", {
        level: 3,
        name: "Licence",
      })
    ).toBeVisible();
    expect(
      within(cards[0] as HTMLElement).getByRole("link", { name: "Licence" })
    ).toHaveAttribute("href", "/help/licence");
    expect(cards[0]).toHaveTextContent("How to reuse our text.");
  });

  it.each([
    [":::aside\n\nText.\n\n:::\n", /Unknown directive ":::aside"/],
    [":::infobox\n\n- **A:** b\n\n:::\n", /:::infobox needs a title/],
    [
      ':::infobox{title="Facts"}\n\nJust a paragraph.\n\n:::\n',
      /:::infobox holds exactly one bulleted list/,
    ],
    [
      ':::infobox{title="Facts"}\n\n- no label here\n\n:::\n',
      /Each infobox item starts with bold text or a link/,
    ],
    [
      ":::cards\n\n- [Out](https://example.com): Away.\n\n:::\n",
      /Each card is an internal link/,
    ],
    ["See :stray in the text.", /Unexpected directive ":stray"/],
    ["::leaf\n", /Unexpected directive ":leaf"/],
  ])("fails the build on a misused directive: %j", async (body, message) => {
    await expect(compileMarkdown(`${FRONTMATTER}\n${body}`)).rejects.toThrow(
      message
    );
  });
});

describe("headings and contents", () => {
  const PAGE = `${FRONTMATTER}
Intro.

## Why can't I just tell you I'm the bard?

### 1. Licensing and copyright

### 2. Performance

## Notes

## Notes
`;

  it("gives h2s and h3s GitHub-style ids, numbering repeats", async () => {
    const { page } = await compileMarkdown(PAGE);
    await renderWithRouter(<MarkdownPart page={page} slot="body" />);
    expect(
      screen
        .getAllByRole("heading")
        .map(heading => [heading.tagName, heading.id])
    ).toEqual([
      ["H2", "why-cant-i-just-tell-you-im-the-bard"],
      ["H3", "1-licensing-and-copyright"],
      ["H3", "2-performance"],
      ["H2", "notes"],
      ["H2", "notes-1"],
    ]);
  });

  it("exports the h2s as `contents`, h3s under them without their own numbers", async () => {
    const { contents } = await compileMarkdown(PAGE);
    expect(contents).toEqual([
      {
        id: "why-cant-i-just-tell-you-im-the-bard",
        label: "Why can't I just tell you I'm the bard?",
        children: [
          { id: "1-licensing-and-copyright", label: "Licensing and copyright" },
          { id: "2-performance", label: "Performance" },
        ],
      },
      { id: "notes", label: "Notes" },
      { id: "notes-1", label: "Notes" },
    ]);
  });
});

describe("slots", () => {
  const PAGE = `${INFOBOX}
The intro.

:::note

A note in the intro.

:::

## First

The body.
`;

  it.each([
    ["infobox", ["At a glance"], ["The intro.", "The body."]],
    ["intro", ["The intro.", "A note in the intro."], ["At a glance", "First"]],
    ["body", ["First", "The body."], ["The intro.", "At a glance"]],
  ] as const)(
    "puts only its own part in the %s slot",
    async (slot, present, absent) => {
      const rendered = await renderSlot(PAGE, slot);
      for (const text of present) {
        expect(rendered).toHaveTextContent(text);
      }
      for (const text of absent) {
        expect(rendered).not.toHaveTextContent(text);
      }
    }
  );
});

describe("links and tables", () => {
  it("marks external links, and wiki links as the original wiki's", async () => {
    const slot = await renderSlot(
      "See [the form](https://forms.gle/x), [the wiki](https://bardictorch.miraheze.org/wiki/Collections) and [the FAQ](/help/faq-for-bards)."
    );
    expect(
      within(slot).getByRole("link", { name: "the form (external link)" })
    ).toHaveAttribute("rel", "noopener");
    expect(
      within(slot).getByRole("link", {
        name: "the wiki (opens original wiki)",
      })
    ).toHaveAttribute(
      "href",
      "https://bardictorch.miraheze.org/wiki/Collections"
    );
    const internal = within(slot).getByRole("link", { name: "the FAQ" });
    expect(internal).toHaveAttribute("href", "/help/faq-for-bards");
    expect(internal).not.toHaveAttribute("rel");
  });

  it("renders GFM tables", async () => {
    const slot = await renderSlot(
      "| Status | Meaning |\n| --- | --- |\n| **Low Risk** | 4 places |\n"
    );
    const table = within(slot).getByRole("table");
    expect(within(table).getAllByRole("columnheader")).toHaveLength(2);
    expect(within(table).getByRole("cell", { name: "4 places" })).toBeVisible();
  });

  it("gives each table row a heading-style id from its first cell, unique on the page", async () => {
    const slot = await renderSlot(
      "## Low Risk\n\n| Status | Meaning |\n| --- | --- |\n| **Low Risk** | 4 places |\n| Critically Endangered | 0 places |\n| Low Risk | again |\n",
      "body"
    );
    const rows = within(slot).getAllByRole("row");
    expect(rows.map(row => row.id)).toEqual([
      "",
      "low-risk-1",
      "critically-endangered",
      "low-risk-2",
    ]);
    expect(within(slot).getByRole("heading", { level: 2 })).toHaveAttribute(
      "id",
      "low-risk"
    );
  });
});
