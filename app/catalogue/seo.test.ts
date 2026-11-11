import type { MetaArgs } from "react-router";
import { describe, expect, it } from "vitest";
import { pageMeta } from "./seo";

const args = (siteOrigin: unknown): Pick<MetaArgs, "matches"> => ({
  matches: [
    {
      id: "root",
      pathname: "/",
      loaderData: { siteOrigin },
      params: {},
      meta: [],
    },
  ],
});
const ORIGIN = "https://bardictorch.example";

function content(tags: ReturnType<typeof pageMeta>, key: string) {
  const tag = tags.find(
    each =>
      ("name" in each && each["name"] === key) ||
      ("property" in each && each["property"] === key)
  );
  return tag && "content" in tag ? tag["content"] : undefined;
}

const description = (text: string) =>
  content(
    pageMeta(args(ORIGIN), { description: text, path: "/" }),
    "description"
  );

describe("pageMeta", () => {
  it("writes the title, canonical link and preview tags; robots only when asked", () => {
    const base = {
      title: "Help",
      description: "Guides.",
      preview: "Anyone can help.",
      path: "/help",
    } as const;
    const tags = pageMeta(args(ORIGIN), base);
    expect(tags).toContainEqual({ title: "Help · Bardic Torch" });
    expect(tags).toContainEqual({
      tagName: "link",
      rel: "canonical",
      href: `${ORIGIN}/help`,
    });
    expect(content(tags, "og:description")).toBe("Anyone can help.");
    expect(content(tags, "robots")).toBeUndefined();
    expect(
      content(pageMeta(args(ORIGIN), { ...base, robots: "noindex" }), "robots")
    ).toBe("noindex");
  });

  it("titles the home page with the site's name alone", () => {
    const tags = pageMeta(args(ORIGIN), { description: "Home.", path: "/" });
    expect(content(tags, "og:title")).toBe("Bardic Torch");
  });

  it("cuts a long description at a word to 160 characters with an ellipsis", () => {
    const words = Array.from({ length: 40 }, (_, i) => `word${i}`);
    const cut = String(description(words.join(" ")));
    expect(cut.length).toBeLessThanOrEqual(160);
    expect(cut.endsWith("…")).toBe(true);
    const kept = cut.slice(0, -1).split(" ");
    expect(kept).toEqual(words.slice(0, kept.length));
  });

  it("keeps exactly 160 characters, folds spaces, and drops a dangling comma", () => {
    const exact = "a".repeat(150) + " bcdefghi.";
    expect(description(exact)).toBe(exact);
    expect(description("  Two\n  lines. ")).toBe("Two lines.");
    expect(description(`${"x".repeat(150)}, ${"y".repeat(20)}`)).toBe(
      `${"x".repeat(150)}…`
    );
  });

  it("leaves the canonical link and og:url out without the root's origin", () => {
    const tags = pageMeta(args(null), { description: "y", path: "/x" });
    expect(tags.some(tag => "tagName" in tag)).toBe(false);
    expect(content(tags, "og:url")).toBeUndefined();
  });
});
