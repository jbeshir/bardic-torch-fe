/**
 * What a compiled `.md` page exports (options.ts): by default the page
 * itself, rendered with a component map; `frontmatter` (the build checks it
 * against helpFrontmatterSchema); and `contents`, its h2s and h3s.
 */
declare module "*.md" {
  function MarkdownPage(props: import("mdx/types").MDXProps): JSX.Element;
  namespace MarkdownPage {
    const frontmatter: import("~/content/help/frontmatter").HelpFrontmatter;
    const contents: readonly import("~/components/TableOfContents").TocEntry[];
  }
  export = MarkdownPage;
}
