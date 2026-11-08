import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown.server";

// A reader's Markdown as the sanitised tree the page renders (plan §0.7):
// what is kept, what is dropped, and an XSS corpus that must come out inert.

const text = (value: string) => ({ type: "text", value });
const paragraph = (...children: unknown[]) => ({ type: "paragraph", children });

describe("renderMarkdown", () => {
  it("is null for nothing to show", () => {
    expect(renderMarkdown(null)).toBeNull();
    expect(renderMarkdown("")).toBeNull();
    expect(renderMarkdown("  \n\n ")).toBeNull();
    expect(renderMarkdown("<div>only html</div>")).toBeNull();
  });

  it("keeps paragraphs, emphasis, strong, code and line breaks", () => {
    expect(
      renderMarkdown(
        "Sung at *many* feasts, **loudly**, with `cups`.  \nAgain."
      )
    ).toEqual([
      paragraph(
        text("Sung at "),
        { type: "emphasis", children: [text("many")] },
        text(" feasts, "),
        { type: "strong", children: [text("loudly")] },
        text(", with "),
        { type: "inlineCode", value: "cups" },
        text("."),
        { type: "break" },
        text("Again.")
      ),
    ]);
  });

  it("keeps lists, ordered ones with their first number", () => {
    expect(renderMarkdown("- one\n- two")).toEqual([
      {
        type: "list",
        ordered: false,
        start: null,
        items: [[paragraph(text("one"))], [paragraph(text("two"))]],
      },
    ]);
    expect(renderMarkdown("3. three\n4. four")).toMatchObject([
      { type: "list", ordered: true, start: 3 },
    ]);
    expect(renderMarkdown("1. one")).toMatchObject([
      { type: "list", ordered: true, start: null },
    ]);
  });

  it("keeps block quotes, code blocks and thematic breaks", () => {
    expect(renderMarkdown("> quoted\n\n```\nverse <b>\n```\n\n***")).toEqual([
      { type: "blockquote", children: [paragraph(text("quoted"))] },
      { type: "code", value: "verse <b>" },
      { type: "thematicBreak" },
    ]);
  });

  it("moves headings down to start at h3, under the page's h2 sections", () => {
    expect(
      renderMarkdown("# One\n\n## Two\n\n### Three\n\n#### Four\n\n###### Six")
    ).toEqual([
      { type: "heading", level: 3, children: [text("One")] },
      { type: "heading", level: 4, children: [text("Two")] },
      { type: "heading", level: 5, children: [text("Three")] },
      { type: "heading", level: 6, children: [text("Four")] },
      { type: "heading", level: 6, children: [text("Six")] },
    ]);
  });

  it.each([
    "https://collections.example/1",
    "http://example.org/a?b=c",
    "mailto:wren@example.org",
  ])("keeps a link to %s", href => {
    expect(renderMarkdown(`[the index](${href})`)).toEqual([
      paragraph({ type: "link", href, children: [text("the index")] }),
    ]);
  });

  it("keeps an image's alt text only, and a reference link's words", () => {
    expect(
      renderMarkdown(
        "![a harp](https://img.example/h.png) and [ref][1]\n\n[1]: https://example.org"
      )
    ).toEqual([paragraph(text("a harp"), text(" and "), text("ref"))]);
  });

  describe("an XSS corpus comes out inert", () => {
    it.each([
      ["a script element", "<script>alert(1)</script>"],
      ["an inline script", "Hi <script>alert(1)</script> there"],
      ["an onerror image", '<img src=x onerror="alert(1)">'],
      ["an svg onload", "<svg onload=alert(1)>"],
      ["nested HTML", "<div><p><a href='javascript:alert(1)'>x</a></p></div>"],
      ["an iframe", '<iframe src="https://evil.example"></iframe>'],
      ["a style element", "<style>body{display:none}</style>"],
      ["a raw span", '<span class="raw">raw html must not render</span>'],
    ])("drops %s", (_why, source) => {
      const tree = JSON.stringify(renderMarkdown(source));
      expect(tree).not.toMatch(/<script|<img|<svg|<iframe|<style|<div|<span/i);
      expect(tree).not.toMatch(/onerror|onload|javascript:/i);
    });

    it.each([
      ["javascript:", "[x](javascript:alert(1))"],
      ["JavaScript: in capitals", "[x](JAVASCRIPT:alert(1))"],
      ["an encoded javascript:", "[x](&#106;avascript:alert(1))"],
      ["data:", "[x](data:text/html,<script>alert(1)</script>)"],
      ["vbscript:", "[x](vbscript:msgbox(1))"],
      ["a relative path", "[x](/settings)"],
      ["a protocol-relative URL", "[x](//evil.example)"],
    ])("keeps only the words of a link to %s", (_why, source) => {
      const tree = JSON.stringify(renderMarkdown(source));
      expect(tree).not.toContain('"link"');
      expect(tree).not.toMatch(/javascript|vbscript|data:|evil/i);
    });

    it("keeps an autolink to javascript: as its words, plain text", () => {
      expect(renderMarkdown("<javascript:alert(1)>")).toEqual([
        paragraph(text("javascript:alert(1)")),
      ]);
    });

    it("keeps entities as the characters they are, as text", () => {
      expect(
        renderMarkdown("&lt;script&gt;alert(1)&lt;/script&gt; &amp;")
      ).toEqual([paragraph(text("<script>alert(1)</script> &"))]);
    });
  });
});
