import { describe, expect, it } from "vitest";
import { pageCount, showingText, redirectPastTheEnd } from "./paging";

const href = (page: number) => (page > 1 ? `/pieces?page=${page}` : "/pieces");

/** Where `redirectPastTheEnd` sends `page` of `total` rows, or null. */
function target(page: number, total: number): string | null {
  try {
    redirectPastTheEnd(page, total, href);
    return null;
  } catch (thrown) {
    if (!(thrown instanceof Response)) throw thrown;
    expect(thrown.status).toBe(302);
    return thrown.headers.get("Location");
  }
}

describe("paging", () => {
  it.each([
    [0, 1],
    [50, 1],
    [51, 2],
  ])("%d rows fill %d pages", (total, pages) => {
    expect(pageCount(total)).toBe(pages);
  });

  it.each([
    ["the first page of an empty list", 1, 0, null],
    ["page 3 of an empty list goes to the first", 3, 0, "/pieces"],
    ["the last page", 5, 245, null],
    ["far past the end goes straight to the last", 999, 245, "/pieces?page=5"],
    ["a page that is exactly full", 2, 100, null],
    ["just past an exactly full page", 3, 100, "/pieces?page=2"],
  ])("%s", (_why, page, total, expected) => {
    expect(target(page, total)).toBe(expected);
  });

  it("reads the page's range of the total", () => {
    expect(showingText(1, 1, 1, "bard")).toBe("Showing 1 bard");
    expect(showingText(2, 50, 249, "piece")).toBe(
      "Showing 51–100 of 249 pieces"
    );
  });
});
