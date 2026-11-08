import type { MetaArgs } from "react-router";
import { describe, expect, it } from "vitest";
import { SERVER_ERROR_META } from "~/components/ErrorPages";
import { historyMeta, matchData } from "./history-meta";

const ROOT = {
  id: "root",
  pathname: "/",
  loaderData: { siteOrigin: "https://bardictorch.example" },
  params: {},
  meta: [],
};

function args(loaderData: unknown, error?: unknown): MetaArgs {
  return {
    loaderData,
    params: {},
    location: { pathname: "/", search: "", hash: "", state: null, key: "k" },
    error,
    matches: [ROOT],
  } as MetaArgs;
}

const OPTIONS = {
  name: "Wren of the Vale",
  path: "/bards/wren-of-the-vale/history",
  missing: "that bard",
} as const;

function titleOf(tags: ReturnType<typeof historyMeta>) {
  const tag = tags.find(each => "title" in each);
  return tag && "title" in tag ? tag.title : undefined;
}

describe("historyMeta", () => {
  it("titles page 1 from the name, noindex with a self canonical", () => {
    const tags = historyMeta(
      args({ state: { page: 1 }, canonical: "" }),
      OPTIONS
    );
    expect(titleOf(tags)).toBe("History of Wren of the Vale · Bardic Torch");
    expect(tags).toContainEqual({ name: "robots", content: "noindex, follow" });
    expect(tags).toContainEqual({
      tagName: "link",
      rel: "canonical",
      href: "https://bardictorch.example/bards/wren-of-the-vale/history",
    });
  });

  it("names the page from page 2, in the title and the canonical", () => {
    const tags = historyMeta(
      args({ state: { page: 2 }, canonical: "?page=2" }),
      OPTIONS
    );
    expect(titleOf(tags)).toBe(
      "History of Wren of the Vale, page 2 · Bardic Torch"
    );
    expect(tags).toContainEqual({
      tagName: "link",
      rel: "canonical",
      href: "https://bardictorch.example/bards/wren-of-the-vale/history?page=2",
    });
  });

  it("also asks crawlers not to follow a restricted piece's history", () => {
    const tags = historyMeta(args({ state: { page: 1 }, canonical: "" }), {
      ...OPTIONS,
      restricted: true,
    });
    expect(tags).toContainEqual({
      name: "robots",
      content: "noindex, nofollow",
    });
  });

  it("falls back to the server error's meta without the layout's name or the history", () => {
    expect(historyMeta(args(undefined), OPTIONS)).toEqual([
      ...SERVER_ERROR_META,
    ]);
    expect(
      historyMeta(args({ state: { page: 1 }, canonical: "" }), {
        ...OPTIONS,
        name: undefined,
      })
    ).toEqual([...SERVER_ERROR_META]);
  });

  it("titles a failure like its boundary", () => {
    const tags = historyMeta(
      args(undefined, {
        status: 404,
        statusText: "",
        internal: false,
        data: { kind: "not_found" },
      }),
      OPTIONS
    );
    expect(titleOf(tags)).toContain("We couldn’t find that bard");
  });
});

describe("matchData", () => {
  it("is the loader data of the route with that id, or nothing", () => {
    const found = {
      ...ROOT,
      id: "routes/bards.$slug",
      loaderData: { person: 1 },
    };
    const metaArgs = { ...args(undefined), matches: [ROOT, found] } as MetaArgs;
    expect(matchData(metaArgs, "routes/bards.$slug")).toEqual({ person: 1 });
    expect(matchData(metaArgs, "routes/other")).toBeUndefined();
  });
});
