import type { MetaArgs } from "react-router";
import { describe, expect, it } from "vitest";
import { SERVER_ERROR_META } from "~/components/ErrorPages";
import { historyMeta } from "./history-meta";

const ROOT = {
  id: "root",
  pathname: "/",
  loaderData: { siteOrigin: "https://bardictorch.example" },
  params: {},
  meta: [],
};

const args = (loaderData: unknown): MetaArgs =>
  ({
    loaderData,
    params: {},
    location: { pathname: "/", search: "", hash: "", state: null, key: "k" },
    matches: [ROOT],
  }) as MetaArgs;

const OPTIONS = {
  name: "Wren of the Vale",
  path: "/bards/wren-of-the-vale/history",
  missing: "that bard",
} as const;

describe("historyMeta", () => {
  it("is noindex with a canonical that names the page from page 2", () => {
    const tags = historyMeta(
      args({ state: { page: 2 }, canonical: "?page=2" }),
      OPTIONS
    );
    expect(tags).toContainEqual({ name: "robots", content: "noindex, follow" });
    expect(tags).toContainEqual({
      tagName: "link",
      rel: "canonical",
      href: "https://bardictorch.example/bards/wren-of-the-vale/history?page=2",
    });
    expect(tags).toContainEqual({
      title: "History of Wren of the Vale, page 2 · Bardic Torch",
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

  it("falls back to the server error's meta without the history", () => {
    expect(historyMeta(args(undefined), OPTIONS)).toEqual([
      ...SERVER_ERROR_META,
    ]);
  });
});
