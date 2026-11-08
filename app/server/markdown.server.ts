import type { Nodes, PhrasingContent, RootContent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import {
  LINK_PROTOCOLS,
  markdownTreeSchema,
  type MarkdownBlock,
  type MarkdownInline,
  type MarkdownTree,
} from "~/schemas/markdown";

/**
 * An API `*_md` field (a reader's Markdown) as the sanitised tree the page
 * renders (plan §0.7). It runs in the loader, so the parser never
 * reaches the browser (`check:prod-build` checks the client build has no
 * micromark).
 *
 * CommonMark only. What is kept: paragraphs, emphasis, strong, lists,
 * inline and block code, block quotes, line breaks, thematic breaks,
 * headings (moved down to start at h3, under the page's h2 sections) and
 * links to `http:`, `https:` and `mailto:` addresses. What is dropped: raw
 * HTML, a link to anything else (its words are kept), an image (its alt
 * text is kept) and anything unknown. The result is checked against the
 * tree's schema before it goes out.
 */
export function renderMarkdown(source: string | null): MarkdownTree | null {
  if (source === null || source.trim() === "") return null;
  const tree = blocks(fromMarkdown(source).children);
  return tree.length > 0 ? markdownTreeSchema.parse(tree) : null;
}

/** Markdown's heading depths, moved down to start under the page's h2s. */
const LEVELS = { 1: 3, 2: 4, 3: 5, 4: 6, 5: 6, 6: 6 } as const;

/** A link's address when it is a web or mail one, else null. */
function safeHref(url: string): string | null {
  if (!URL.canParse(url)) return null;
  return LINK_PROTOCOLS.includes(new URL(url).protocol) ? url : null;
}

function blocks(nodes: readonly RootContent[]): MarkdownBlock[] {
  return nodes.flatMap((node): MarkdownBlock[] => {
    switch (node.type) {
      case "paragraph": {
        const children = inlines(node.children);
        return children.length > 0 ? [{ type: "paragraph", children }] : [];
      }
      case "heading":
        return [
          {
            type: "heading",
            level: LEVELS[node.depth],
            children: inlines(node.children),
          },
        ];
      case "list":
        return [
          {
            type: "list",
            ordered: node.ordered === true,
            start:
              node.ordered === true &&
              typeof node.start === "number" &&
              node.start !== 1
                ? node.start
                : null,
            items: node.children.map(item => blocks(item.children)),
          },
        ];
      case "blockquote":
        return [{ type: "blockquote", children: blocks(node.children) }];
      case "code":
        return [{ type: "code", value: node.value }];
      case "thematicBreak":
        return [{ type: "thematicBreak" }];
      default:
        // Raw HTML, definitions and anything else: not shown.
        return [];
    }
  });
}

function inlines(nodes: readonly PhrasingContent[]): MarkdownInline[] {
  return nodes.flatMap((node): MarkdownInline[] => inline(node));
}

function inline(node: Nodes): MarkdownInline[] {
  switch (node.type) {
    case "text":
      return [{ type: "text", value: node.value }];
    case "inlineCode":
      return [{ type: "inlineCode", value: node.value }];
    case "break":
      return [{ type: "break" }];
    case "emphasis":
    case "strong":
      return [{ type: node.type, children: inlines(node.children) }];
    case "link": {
      const children = inlines(node.children);
      const href = safeHref(node.url);
      return href ? [{ type: "link", href, children }] : children;
    }
    case "linkReference":
      // A reference link's words; its definitions aren't kept.
      return inlines(node.children);
    case "image":
    case "imageReference":
      return node.alt ? [{ type: "text", value: node.alt }] : [];
    default:
      // Raw HTML and anything else: not shown.
      return [];
  }
}
