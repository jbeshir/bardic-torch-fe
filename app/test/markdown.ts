import { evaluate } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import { MARKDOWN_OPTIONS } from "~/content/markdown/options";
import type { HelpContent } from "~/content/help/pages";
import type { TocEntry } from "~/components/TableOfContents";

/** Front matter that passes the schema, for pages written in tests. */
export const FRONTMATTER = `---
title: Test page
description: A page written by a test.
summary: What a test page is for.
sourcePages:
  - Main Page
lastReviewed: 2026-10-31
---
`;

/**
 * Compiles Markdown with the build's own pipeline (options.ts) and runs it,
 * as Vite does for app/content/*.md.
 */
export async function compileMarkdown(source: string) {
  const compiled = await evaluate(source, { ...MARKDOWN_OPTIONS, ...runtime });
  return {
    page: compiled.default as HelpContent["page"],
    frontmatter: compiled["frontmatter"] as HelpContent["frontmatter"],
    contents: compiled["contents"] as readonly TocEntry[],
  };
}
