import { z } from "zod";

/**
 * The sanitised Markdown tree a loader sends for an API `*_md` field (plan
 * §0.7, C4.2): what `app/server/markdown.server.ts` makes of the text, and
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

/** The addresses a link may have. */
export const LINK_PROTOCOLS: readonly string[] = ["http:", "https:", "mailto:"];

const inlineSchema: z.ZodType<MarkdownInline> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.strictObject({ type: z.literal("text"), value: z.string() }),
    z.strictObject({ type: z.literal("inlineCode"), value: z.string() }),
    z.strictObject({ type: z.literal("break") }),
    z.strictObject({
      type: z.enum(["emphasis", "strong"]),
      children: z.array(inlineSchema),
    }),
    z.strictObject({
      type: z.literal("link"),
      href: z
        .string()
        .refine(
          href =>
            URL.canParse(href) &&
            LINK_PROTOCOLS.includes(new URL(href).protocol),
          "a web or mail address"
        ),
      children: z.array(inlineSchema),
    }),
  ])
);

const blockSchema: z.ZodType<MarkdownBlock> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.strictObject({
      type: z.literal("paragraph"),
      children: z.array(inlineSchema),
    }),
    z.strictObject({
      type: z.literal("heading"),
      level: z.union([z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
      children: z.array(inlineSchema),
    }),
    z.strictObject({
      type: z.literal("list"),
      ordered: z.boolean(),
      start: z.int().nullable(),
      items: z.array(z.array(blockSchema)),
    }),
    z.strictObject({
      type: z.literal("blockquote"),
      children: z.array(blockSchema),
    }),
    z.strictObject({ type: z.literal("code"), value: z.string() }),
    z.strictObject({ type: z.literal("thematicBreak") }),
  ])
);

/** Checks a tree: an unknown node type, or a link to anything but the web or mail, fails. */
export const markdownTreeSchema = z.array(blockSchema);
