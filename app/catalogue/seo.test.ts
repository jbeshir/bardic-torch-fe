import type { MetaArgs } from "react-router";
import { describe, expect, it } from "vitest";
import { pageMeta } from "./seo";

const ORIGIN = "https://bardictorch.example";

/** Meta args whose root match carries the root loader's origin. */
function args(siteOrigin: unknown = ORIGIN): Pick<MetaArgs, "matches"> {
  return {
    matches: [
      {
        id: "root",
        pathname: "/",
        loaderData: { siteOrigin },
        params: {},
        meta: [],
      },
    ],
  };
}

function content(tags: ReturnType<typeof pageMeta>, key: string) {
  const tag = tags.find(
    each =>
      ("name" in each && each["name"] === key) ||
      ("property" in each && each["property"] === key)
  );
  return tag && "content" in tag ? tag["content"] : undefined;
}

describe("pageMeta", () => {
  it("writes the title, description, canonical link and preview tags", () => {
    expect(
      pageMeta(args(), {
        title: "Licence and attribution",
        description: "What you can reuse.",
        path: "/help/licence",
        type: "profile",
      })
    ).toEqual([
      { title: "Licence and attribution · Bardic Torch" },
      { name: "description", content: "What you can reuse." },
      {
        tagName: "link",
        rel: "canonical",
        href: "https://bardictorch.example/help/licence",
      },
      { property: "og:title", content: "Licence and attribution" },
      { property: "og:description", content: "What you can reuse." },
      {
        property: "og:url",
        content: "https://bardictorch.example/help/licence",
      },
      { property: "og:type", content: "profile" },
      { property: "og:site_name", content: "Bardic Torch" },
      { property: "og:locale", content: "en_GB" },
      { name: "twitter:card", content: "summary" },
    ]);
  });

  it("titles the home page with the site's name alone, as a website", () => {
    const tags = pageMeta(args(), { description: "Home.", path: "/" });
    expect(tags).toContainEqual({ title: "Bardic Torch" });
    expect(content(tags, "og:title")).toBe("Bardic Torch");
    expect(content(tags, "og:type")).toBe("website");
    expect(content(tags, "og:url")).toBe("https://bardictorch.example/");
  });

  it("gives previews their own line when there is one", () => {
    const tags = pageMeta(args(), {
      title: "Help",
      description: "Guides.",
      preview: "Anyone can help.",
      path: "/help",
    });
    expect(content(tags, "description")).toBe("Guides.");
    expect(content(tags, "og:description")).toBe("Anyone can help.");
  });

  it("adds robots only when asked", () => {
    const base = { title: "x", description: "y", path: "/x" } as const;
    expect(content(pageMeta(args(), base), "robots")).toBeUndefined();
    expect(
      content(
        pageMeta(args(), { ...base, robots: "noindex, nofollow" }),
        "robots"
      )
    ).toBe("noindex, nofollow");
  });

  it("cuts a long description at a word, to 160 characters with an ellipsis", () => {
    const words = Array.from({ length: 40 }, (_, index) => `word${index}`);
    const long = words.join(" ");
    const tags = pageMeta(args(), { description: long, path: "/" });
    const description = String(content(tags, "description"));
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description.endsWith("…")).toBe(true);
    const kept = description.slice(0, -1).split(" ");
    expect(kept).toEqual(words.slice(0, kept.length));
    // The preview, from the same text, is cut the same way.
    expect(content(tags, "og:description")).toBe(description);
  });

  it("keeps a description of exactly 160 characters, and folds its spaces", () => {
    const exact = "a".repeat(150) + " bcdefghi.";
    expect(exact).toHaveLength(160);
    expect(
      content(
        pageMeta(args(), { description: exact, path: "/" }),
        "description"
      )
    ).toBe(exact);
    expect(
      content(
        pageMeta(args(), { description: "  Two\n  lines. ", path: "/" }),
        "description"
      )
    ).toBe("Two lines.");
  });

  it("keeps a whole last word when the cut falls just after it, and drops a dangling comma", () => {
    const text = `${"x".repeat(150)}, abcdefg ${"y".repeat(20)}`;
    // Character 160 is the space after "abcdefg".
    expect(text[159]).toBe(" ");
    expect(
      content(pageMeta(args(), { description: text, path: "/" }), "description")
    ).toBe(`${"x".repeat(150)}, abcdefg…`);
    const comma = `${"x".repeat(150)}, ${"y".repeat(20)}`;
    expect(
      content(
        pageMeta(args(), { description: comma, path: "/" }),
        "description"
      )
    ).toBe(`${"x".repeat(150)}…`);
  });

  it("leaves the canonical link and og:url out without the root's origin", () => {
    for (const missing of [null, 42]) {
      const tags = pageMeta(args(missing), { description: "y", path: "/x" });
      expect(tags.some(tag => "tagName" in tag)).toBe(false);
      expect(content(tags, "og:url")).toBeUndefined();
    }
    expect(
      pageMeta({ matches: [] }, { description: "y", path: "/x" })
    ).toContainEqual({ name: "twitter:card", content: "summary" });
  });
});

describe("pageMeta structured data (C4.1)", () => {
  it("adds the page's JSON-LD, built with the site's origin", () => {
    const tags = pageMeta(args(), {
      title: "The Copper Kettle",
      description: "A song.",
      path: "/pieces/the-copper-kettle",
      structuredData: origin => ({ url: `${origin}/pieces/x` }),
    });
    expect(tags).toContainEqual({
      "script:ld+json": { url: `${ORIGIN}/pieces/x` },
    });
  });

  it("leaves it out without an origin to build it with, or when not asked", () => {
    const has = (tags: ReturnType<typeof pageMeta>) =>
      tags.some(tag => "script:ld+json" in tag);
    const page = { description: "A song.", path: "/pieces/x" } as const;
    expect(
      has(pageMeta(args(null), { ...page, structuredData: () => ({}) }))
    ).toBe(false);
    expect(has(pageMeta(args(), page))).toBe(false);
  });
});
