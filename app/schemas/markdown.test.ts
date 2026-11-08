import { describe, expect, it } from "vitest";
import { markdownTreeSchema } from "./markdown";

describe("markdownTreeSchema", () => {
  it("accepts every node the tree has", () => {
    const tree = [
      {
        type: "paragraph",
        children: [
          { type: "text", value: "a" },
          { type: "emphasis", children: [{ type: "text", value: "b" }] },
          { type: "strong", children: [] },
          { type: "inlineCode", value: "c" },
          { type: "break" },
          {
            type: "link",
            href: "https://example.org",
            children: [{ type: "text", value: "d" }],
          },
          { type: "link", href: "mailto:a@example.org", children: [] },
        ],
      },
      { type: "heading", level: 3, children: [] },
      { type: "list", ordered: true, start: 2, items: [[]] },
      { type: "blockquote", children: [] },
      { type: "code", value: "x" },
      { type: "thematicBreak" },
    ];
    expect(markdownTreeSchema.safeParse(tree).success).toBe(true);
  });

  it.each([
    ["an unknown block", [{ type: "html", value: "<script>" }]],
    [
      "an unknown inline",
      [{ type: "paragraph", children: [{ type: "image", url: "x" }] }],
    ],
    ["an h2", [{ type: "heading", level: 2, children: [] }]],
    [
      "a javascript: link",
      [
        {
          type: "paragraph",
          children: [
            { type: "link", href: "javascript:alert(1)", children: [] },
          ],
        },
      ],
    ],
    [
      "a relative link",
      [
        {
          type: "paragraph",
          children: [{ type: "link", href: "/x", children: [] }],
        },
      ],
    ],
    ["an extra field", [{ type: "thematicBreak", html: "<hr>" }]],
  ])("rejects %s", (_why, tree) => {
    expect(markdownTreeSchema.safeParse(tree).success).toBe(false);
  });
});
