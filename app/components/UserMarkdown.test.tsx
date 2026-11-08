import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MarkdownTree } from "~/schemas/markdown";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { UserMarkdown } from "./UserMarkdown";

const text = (value: string) => ({ type: "text", value }) as const;

const TREE: MarkdownTree = [
  {
    type: "paragraph",
    children: [
      text("Sung at "),
      { type: "emphasis", children: [text("many")] },
      text(" feasts; see "),
      {
        type: "link",
        href: "https://collections.example/1",
        children: [text("the tune index")],
      },
      text(" or "),
      {
        type: "link",
        href: "mailto:wren@example.org",
        children: [text("write")],
      },
      text("."),
      { type: "break" },
      { type: "strong", children: [text("Loud")] },
      { type: "inlineCode", value: "cups" },
    ],
  },
  { type: "heading", level: 3, children: [text("Verses")] },
  {
    type: "list",
    ordered: false,
    start: null,
    items: [
      [{ type: "paragraph", children: [text("The first verse is short")] }],
      [{ type: "paragraph", children: [text("The chorus repeats")] }],
    ],
  },
  {
    type: "list",
    ordered: true,
    start: 3,
    items: [[{ type: "paragraph", children: [text("Third")] }]],
  },
  {
    type: "blockquote",
    children: [{ type: "paragraph", children: [text("Quoted")] }],
  },
  { type: "code", value: "a <b> c" },
  { type: "thematicBreak" },
];

describe("UserMarkdown", () => {
  it("renders the tree as plain elements", async () => {
    await renderWithRouter(<UserMarkdown tree={TREE} />);
    const container = document.body;
    expect(screen.getByText("many").tagName).toBe("EM");
    expect(screen.getByText("Loud").tagName).toBe("STRONG");
    expect(screen.getByText("cups").tagName).toBe("CODE");
    expect(
      screen.getByRole("heading", { level: 3, name: "Verses" })
    ).toBeVisible();
    const [bullets, numbers] = screen.getAllByRole("list");
    expect(bullets?.tagName).toBe("UL");
    expect(
      within(bullets as HTMLElement)
        .getAllByRole("listitem")
        .map(item => item.textContent)
    ).toEqual(["The first verse is short", "The chorus repeats"]);
    expect(numbers).toHaveAttribute("start", "3");
    expect(screen.getByText("Quoted").closest("blockquote")).not.toBeNull();
    expect(screen.getByText("a <b> c").closest("pre")).not.toBeNull();
    expect(container.querySelector("hr")).not.toBeNull();
    expect(container.querySelector("br")).not.toBeNull();
  });

  it("links a reader's addresses without following or crediting them", async () => {
    await renderWithRouter(<UserMarkdown tree={TREE} />);
    const web = screen.getByRole("link", {
      name: "the tune index (external link)",
    });
    expect(web).toHaveAttribute("href", "https://collections.example/1");
    expect(web).toHaveAttribute("rel", "nofollow ugc noopener");
    const mail = screen.getByRole("link", { name: "write" });
    expect(mail).toHaveAttribute("href", "mailto:wren@example.org");
    expect(mail).toHaveAttribute("rel", "nofollow ugc noopener");
  });

  it("renders text as text, never as markup", async () => {
    await renderWithRouter(
      <UserMarkdown
        tree={[{ type: "paragraph", children: [text("<script>x</script>")] }]}
      />
    );
    expect(screen.getByText("<script>x</script>")).toBeVisible();
    expect(document.querySelector("script")).toBeNull();
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(<UserMarkdown tree={TREE} />)
    );
  });
});
