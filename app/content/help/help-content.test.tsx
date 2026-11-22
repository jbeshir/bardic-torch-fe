import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HelpPage } from "~/components/HelpPage";
import { HELP_PAGES, wikiPageUrl } from "~/constants/navigation";
import { renderWithRouter } from "~/test/router";
import { findHelpPage, HELP_INDEX, type HelpContent } from "./pages";

const ALL = [
  ["index", HELP_INDEX],
  ...HELP_PAGES.map(({ slug }) => [slug, findHelpPage(slug)] as const),
] as const;

async function renderHelp(content: HelpContent, slug: string) {
  await renderWithRouter(
    <main>
      <HelpPage content={content} />
    </main>,
    slug === "index" ? "/help" : `/help/${slug}`
  );
  return screen.getByRole("main");
}

describe.each(ALL)("help page %s", (slug, content) => {
  it("has front matter and one h1, titled by it", async () => {
    if (!content) throw new Error(`No help page "${slug}"`);
    const { title, sourcePages } = content.frontmatter;
    expect(sourcePages.length === 0).toBe(
      slug === "index" || slug === "privacy"
    );
    const main = await renderHelp(content, slug);
    expect(within(main).getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(within(main).getByRole("heading", { level: 1 })).toHaveTextContent(
      title
    );
  });

  it("links only over https, or to this site", async () => {
    if (!content) throw new Error(`No help page "${slug}"`);
    const main = await renderHelp(content, slug);
    for (const link of within(main).getAllByRole("link")) {
      const href = link.getAttribute("href") ?? "";
      expect(href).toMatch(/^(https:\/\/|\/|#)/);
    }
  });

  it("credits the original wiki page it came from, under CC BY-SA 4.0", async () => {
    if (!content) throw new Error(`No help page "${slug}"`);
    const main = await renderHelp(content, slug);
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
        /adapted from .* by its contributors, with changes; see Licence & attribution\./i
      );
      expect(
        within(licence).getByRole("link", { name: "Licence & attribution" })
      ).toHaveAttribute("href", "/help/licence");
    }
  });

  it("says how much of it is adapted, under the title", async () => {
    if (!content) throw new Error(`No help page "${slug}"`);
    const [source] = content.frontmatter.sourcePages;
    const main = await renderHelp(content, slug);
    const credit = within(main).queryByRole("link", {
      name: /^(partly )?adapted from the original wiki/i,
    });
    if (!source) {
      expect(credit).toBeNull();
      return;
    }
    expect(credit).toHaveAttribute("href", wikiPageUrl(source));
    expect(credit).toHaveTextContent(
      content.frontmatter.partlyAdapted
        ? "Partly adapted from the original wiki"
        : /^Adapted from the original wiki/
    );
  });
});
