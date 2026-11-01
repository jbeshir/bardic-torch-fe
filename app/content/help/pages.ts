import type { TocEntry } from "~/components/TableOfContents";
import * as checklist from "./bard-preference-checklist.md";
import * as conservation from "./conservation-status.md";
import * as contributing from "./contributing.md";
import * as faq from "./faq-for-bards.md";
import type { HelpFrontmatter } from "./frontmatter";
import * as index from "./index.md";
import * as licence from "./licence.md";

/** A compiled help page and what its front matter says about it. */
export type HelpContent = {
  /** Its address under /help, or null for the index (/help itself). */
  readonly slug: string | null;
  readonly page: MarkdownModule["default"];
  readonly frontmatter: HelpFrontmatter;
  readonly contents: readonly TocEntry[];
};

type MarkdownModule = typeof index;

function helpContent(slug: string | null, module: MarkdownModule): HelpContent {
  return {
    slug,
    page: module.default,
    frontmatter: module.frontmatter,
    contents: module.contents,
  };
}

/** The help index, at /help. */
export const HELP_INDEX = helpContent(null, index);

/** The help pages, at /help/{slug}, in the site navigation's order. */
const HELP_PAGES: readonly HelpContent[] = [
  helpContent("contributing", contributing),
  helpContent("faq-for-bards", faq),
  helpContent("bard-preference-checklist", checklist),
  helpContent("conservation-status", conservation),
  helpContent("licence", licence),
];

export function findHelpPage(slug: string | undefined): HelpContent | null {
  return HELP_PAGES.find(page => page.slug === slug) ?? null;
}
