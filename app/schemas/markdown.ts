/**
 * The sanitised Markdown tree a loader sends for an API `*_md` field (plan
 * §0.7): what `app/server/markdown.server.ts` makes of the text, and
 * all `UserMarkdown` renders. Only these nodes exist, so raw HTML, scripts
 * and images can't reach the page: the parser runs on the server only, and
 * the browser gets plain data.
 *
 * Headings start at h3 (the page's sections are h2s); links are web or
 * mail addresses only.
 */

export type MarkdownInline =
  | { readonly type: "text"; readonly value: string }
  | { readonly type: "inlineCode"; readonly value: string }
  | { readonly type: "break" }
  | {
      readonly type: "emphasis" | "strong";
      readonly children: readonly MarkdownInline[];
    }
  | {
      readonly type: "link";
      /** An `http:`, `https:` or `mailto:` address. */
      readonly href: string;
      readonly children: readonly MarkdownInline[];
    };

export type MarkdownBlock =
  | {
      readonly type: "paragraph";
      readonly children: readonly MarkdownInline[];
    }
  | {
      readonly type: "heading";
      readonly level: 3 | 4 | 5 | 6;
      readonly children: readonly MarkdownInline[];
    }
  | {
      readonly type: "list";
      readonly ordered: boolean;
      /** An ordered list's first number, when it isn't 1. */
      readonly start: number | null;
      readonly items: readonly (readonly MarkdownBlock[])[];
    }
  | { readonly type: "blockquote"; readonly children: readonly MarkdownBlock[] }
  | { readonly type: "code"; readonly value: string }
  | { readonly type: "thematicBreak" };

/** A field's text as blocks. */
export type MarkdownTree = readonly MarkdownBlock[];
