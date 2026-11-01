import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { wikiPageUrl } from "~/constants/navigation";
import { HELP_INDEX, type HelpContent } from "~/content/help/pages";
import { compileMarkdown, FRONTMATTER } from "~/test/markdown";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { HelpPage, helpMeta } from "./HelpPage";

const SOURCE = `${FRONTMATTER.replace(
  "  - Main Page",
  "  - Conservation Status\n  - Main Page\n  - FAQ for Bards"
)}
:::infobox{title="At a glance"}

- **Statuses:** five of them.

:::

Statuses flag works that need help.

## One

### One point one

## Two

## Three

## Four
`;

async function testPage(source = SOURCE): Promise<HelpContent> {
  return { slug: "test-page", ...(await compileMarkdown(source)) };
}

async function renderHelpPage(content: HelpContent) {
  return renderWithRouter(<HelpPage content={content} />, "/help/test-page");
}

describe("HelpPage", () => {
  it("has the Help breadcrumb, the title and the source link on the title rule", async () => {
    await renderHelpPage(await testPage());
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getByRole("link", { name: "Help" })).toHaveAttribute(
      "href",
      "/help"
    );
    expect(within(crumbs).getByText("Test page")).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Test page" })
    ).toBeVisible();
    expect(
      screen.getByRole("link", {
        name: "Adapted from the original wiki (opens original wiki)",
      })
    ).toHaveAttribute("href", wikiPageUrl("Conservation Status"));
  });

  it("puts the infobox before the intro, then the contents, then the prose", async () => {
    await renderHelpPage(await testPage());
    const infobox = screen.getByRole("complementary", { name: "At a glance" });
    const intro = screen.getByText("Statuses flag works that need help.");
    const contents = screen.getByRole("navigation", { name: "Contents" });
    const first = screen.getByRole("heading", { level: 2, name: "One" });
    const order = [infobox, intro, contents, first];
    for (const [index, node] of order.slice(1).entries()) {
      expect(
        (order[index] as Node).compareDocumentPosition(node) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }
    expect(infobox.closest(".prose-bt")).toBeNull();
    expect(intro.closest(".prose-bt")).not.toBeNull();
    expect(
      within(contents).getByRole("link", { name: "1.1 One point one" })
    ).toHaveAttribute("href", "#one-point-one");
  });

  it("shows no contents with fewer than four h2s", async () => {
    await renderHelpPage(
      await testPage(SOURCE.replace("## Three\n\n## Four\n", ""))
    );
    expect(screen.queryByRole("navigation", { name: "Contents" })).toBeNull();
  });

  it("ends with the Help chip and the licence line crediting every source page", async () => {
    await renderHelpPage(await testPage());
    const chips = screen.getByRole("navigation", { name: "Categories" });
    expect(within(chips).getByRole("link", { name: "Help" })).toHaveAttribute(
      "href",
      "/help"
    );
    const licence = screen.getByText(/^This page is available under/);
    expect(licence).toHaveTextContent(
      "This page is available under CC BY-SA 4.0 (external link). Adapted from ‘Conservation Status’ (opens original wiki), ‘Main Page’ (opens original wiki) and ‘FAQ for Bards’ (opens original wiki) on the original Bardic Torch wiki by its contributors. Last reviewed 31 October 2026."
    );
    expect(
      within(licence).getByRole("link", { name: /CC BY-SA 4\.0/ })
    ).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by-sa/4.0/"
    );
    expect(
      within(licence).getByRole("link", { name: /‘FAQ for Bards’/ })
    ).toHaveAttribute("href", wikiPageUrl("FAQ for Bards"));
    expect(within(licence).getByText("31 October 2026")).toHaveAttribute(
      "dateTime",
      "2026-10-31"
    );
  });

  it("names a single source page on its own", async () => {
    await renderHelpPage(await testPage(FRONTMATTER + "\nJust text.\n"));
    expect(screen.getByText(/^This page is available under/)).toHaveTextContent(
      "Adapted from ‘Main Page’ (opens original wiki) on the original"
    );
  });

  it("shows the index without breadcrumbs, source or chips, its summary as the intro", async () => {
    await renderWithRouter(<HelpPage content={HELP_INDEX} />, "/help");
    expect(
      screen.getByRole("heading", { level: 1, name: "Help" })
    ).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Categories" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Adapted from/ })).toBeNull();
    expect(
      screen.getByText(HELP_INDEX.frontmatter.summary).closest(".prose-bt")
    ).not.toBeNull();
    expect(
      screen.getByText(/^This page is available under/)
    ).not.toHaveTextContent("Adapted from");
  });

  it("looks the same in both themes", async () => {
    const content = await testPage();
    await expectSameMarkupInBothThemes(() => renderHelpPage(content));
  });
});

describe("helpMeta", () => {
  it("titles the page, describes it and gives the summary to previews", () => {
    expect(helpMeta(HELP_INDEX.frontmatter)).toEqual([
      { title: "Help · Bardic Torch" },
      { name: "description", content: HELP_INDEX.frontmatter.description },
      { property: "og:title", content: "Help" },
      { property: "og:description", content: HELP_INDEX.frontmatter.summary },
    ]);
  });
});
