import { describe, expect, it } from "vitest";
import { failureMeta, ignoreSearchChanges } from "./entity-route";

function args(current: string, next: string, defaultShouldRevalidate = true) {
  return {
    currentUrl: new URL(`https://app.test${current}`),
    currentParams: {},
    nextUrl: new URL(`https://app.test${next}`),
    nextParams: {},
    defaultShouldRevalidate,
  };
}

describe("ignoreSearchChanges (plan §1)", () => {
  it("leaves the layout be when only the search changes", () => {
    expect(
      ignoreSearchChanges(
        args("/categories/joyful", "/categories/joyful?page=2")
      )
    ).toBe(false);
    expect(
      ignoreSearchChanges(
        args("/categories/x/history?page=2", "/categories/x/history?page=3")
      )
    ).toBe(false);
  });

  it("is the default otherwise", () => {
    // Try again: the same URL, revalidated.
    expect(
      ignoreSearchChanges(args("/categories/x", "/categories/x", true))
    ).toBe(true);
    expect(ignoreSearchChanges(args("/categories/x", "/categories/y"))).toBe(
      true
    );
    expect(
      ignoreSearchChanges(args("/categories/x", "/categories/x/history", false))
    ).toBe(false);
  });
});

describe("failureMeta", () => {
  it("titles a thrown failure like its boundary, kept out of search", () => {
    const thrown = {
      status: 404,
      statusText: "",
      internal: false,
      data: { kind: "not_found" },
    };
    expect(failureMeta(thrown, "this piece", "that piece")).toEqual([
      { title: "We couldn’t find that piece · Bardic Torch" },
      { name: "robots", content: "noindex" },
    ]);
  });

  it("titles anything unexpected as the server error its boundary shows", () => {
    expect(failureMeta(new Error("bug"), "this piece", "that piece")).toEqual([
      { title: "We couldn’t load this piece · Bardic Torch" },
      { name: "robots", content: "noindex" },
    ]);
  });
});
