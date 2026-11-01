import type { TocEntry } from "~/components/TableOfContents";
import type { HelpFrontmatter } from "./frontmatter";
import * as index from "./index.md";

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
