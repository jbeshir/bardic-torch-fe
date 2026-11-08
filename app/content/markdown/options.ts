import type { CompileOptions } from "@mdx-js/mdx";
import remarkDirective from "remark-directive";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import { rehypeHelpPage } from "./rehype-help-page.ts";
import { remarkCheckFrontmatter } from "./remark-check-frontmatter.ts";
import { remarkDirectives } from "./remark-directives.ts";

/**
 * How help pages compile (plan §0.10): plain Markdown (`format: "md"`, so
 * no JSX in content and Prettier formats it safely) with GFM tables, YAML
 * front matter (checked against helpFrontmatterSchema) exported as
 * `frontmatter`, and the container directives in
 * remark-directives.ts. Vite (vite.config.ts) and the content tests both
 * use this, so the tests check what the build ships.
 */
export const MARKDOWN_OPTIONS = {
  format: "md",
  remarkPlugins: [
    remarkFrontmatter,
    remarkCheckFrontmatter,
    [remarkMdxFrontmatter, { name: "frontmatter" }],
    remarkGfm,
    remarkDirective,
    remarkDirectives,
  ],
  rehypePlugins: [rehypeHelpPage],
} satisfies CompileOptions;
