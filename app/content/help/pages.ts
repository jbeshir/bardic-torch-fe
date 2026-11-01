import type { TocEntry } from "~/components/TableOfContents";
import { HELP_PAGES, type HelpSlug } from "~/constants/navigation";
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
  readonly slug: HelpSlug | null;
  readonly page: MarkdownModule["default"];
  readonly frontmatter: HelpFrontmatter;
  readonly contents: readonly TocEntry[];
};

type MarkdownModule = typeof index;

function helpContent(
  slug: HelpSlug | null,
  module: MarkdownModule
): HelpContent {
  return {
    slug,
    page: module.default,
    frontmatter: module.frontmatter,
    contents: module.contents,
  };
}

/** The help index, at /help. */
export const HELP_INDEX = helpContent(null, index);

/** Each help page's compiled Markdown, by slug: one for every HELP_PAGES entry. */
const MODULES: Readonly<Record<HelpSlug, MarkdownModule>> = {
  contributing,
  "faq-for-bards": faq,
  "bard-preference-checklist": checklist,
  "conservation-status": conservation,
  licence,
};

/** The help pages, at /help/{slug}. */
const PAGES: readonly HelpContent[] = HELP_PAGES.map(({ slug }) =>
  helpContent(slug, MODULES[slug])
);

export function findHelpPage(slug: string | undefined): HelpContent | null {
  return PAGES.find(page => page.slug === slug) ?? null;
}
