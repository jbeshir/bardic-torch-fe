import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown.server";

// A reader's Markdown as the sanitised tree the page renders: what is kept,
// what is dropped, and that scripts and unsafe links come out inert.

const text = (value: string) => ({ type: "text", value });
const paragraph = (...children: unknown[]) => ({ type: "paragraph", children });

describe("renderMarkdown", () => {
  it.each([null, "", "  \n\n ", "<div>only html</div>"])(
    "is null for nothing to show: %j",
    source => {
      expect(renderMarkdown(source)).toBeNull();
    }
  );

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

  it("keeps lists, block quotes, code blocks and thematic breaks", () => {
    expect(renderMarkdown("3. three\n4. four")).toMatchObject([
      { type: "list", ordered: true, start: 3 },
    ]);
    expect(renderMarkdown("> quoted\n\n```\nverse <b>\n```\n\n***")).toEqual([
      { type: "blockquote", children: [paragraph(text("quoted"))] },
      { type: "code", value: "verse <b>" },
      { type: "thematicBreak" },
    ]);
  });

  it("moves headings down to start at h3, under the page's h2 sections", () => {
    expect(renderMarkdown("# One\n\n###### Six")).toEqual([
      { type: "heading", level: 3, children: [text("One")] },
      { type: "heading", level: 6, children: [text("Six")] },
    ]);
  });

  it.each(["https://collections.example/1", "mailto:wren@example.org"])(
    "keeps a link to %s",
    href => {
      expect(renderMarkdown(`[the index](${href})`)).toEqual([
        paragraph({ type: "link", href, children: [text("the index")] }),
      ]);
    }
  );

  it("keeps an image's alt text only", () => {
    expect(renderMarkdown("![a harp](https://img.example/h.png)")).toEqual([
      paragraph(text("a harp")),
    ]);
  });

  it.each([
    ["a script element", "<script>alert(1)</script>"],
    ["an onerror image", '<img src=x onerror="alert(1)">'],
    ["an svg onload", "<svg onload=alert(1)>"],
    ["an iframe", '<iframe src="https://evil.example"></iframe>'],
    ["a raw span", '<span class="raw">raw html must not render</span>'],
  ])("drops %s", (_why, source) => {
    const tree = JSON.stringify(renderMarkdown(source));
    expect(tree).not.toMatch(/<script|<img|<svg|<iframe|<span/i);
    expect(tree).not.toMatch(/onerror|onload|javascript:/i);
  });

  it.each([
    ["javascript:", "[x](javascript:alert(1))"],
    ["an encoded javascript:", "[x](&#106;avascript:alert(1))"],
    ["data:", "[x](data:text/html,<script>alert(1)</script>)"],
    ["a relative path", "[x](/settings)"],
    ["a protocol-relative URL", "[x](//evil.example)"],
  ])("keeps only the words of a link to %s", (_why, source) => {
    const tree = JSON.stringify(renderMarkdown(source));
    expect(tree).not.toContain('"link"');
    expect(tree).not.toMatch(/javascript|data:|evil/i);
  });

  it("keeps entities as the characters they are, as text", () => {
    expect(
      renderMarkdown("&lt;script&gt;alert(1)&lt;/script&gt; &amp;")
    ).toEqual([paragraph(text("<script>alert(1)</script> &"))]);
  });
});
