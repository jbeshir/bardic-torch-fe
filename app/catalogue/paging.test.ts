import { describe, expect, it } from "vitest";
import {
  isBeyondApi,
  isCapped,
  pageCount,
  redirectPastTheEnd,
  SHOWN_MAX,
} from "./paging";

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

describe("pageCount", () => {
  it.each([
    [0, 1],
    [1, 1],
    [50, 1],
    [51, 2],
    [245, 5],
    [10_000, 200],
    [10_001, 201],
    [10_050, 201],
    [10_051, 201],
    [1_000_000, 201],
  ])("%d rows fill %d pages", (total, pages) => {
    expect(pageCount(total)).toBe(pages);
  });
});

describe("isCapped", () => {
  it("is true only past the 10,050 rows the pages can show", () => {
    expect(SHOWN_MAX).toBe(10_050);
    expect(isCapped(10_050)).toBe(false);
    expect(isCapped(10_051)).toBe(true);
    expect(isCapped(0)).toBe(false);
  });
});

describe("isBeyondApi", () => {
  it("is true past page 201 (offset 10,000)", () => {
    expect(isBeyondApi(201)).toBe(false);
    expect(isBeyondApi(202)).toBe(true);
  });
});

describe("redirectPastTheEnd", () => {
  it.each([
    ["the first page of an empty list", 1, 0, null],
    ["page 3 of an empty list goes to the first", 3, 0, "/pieces"],
    ["the last page", 5, 245, null],
    ["one past the last page goes to the last", 6, 245, "/pieces?page=5"],
    ["far past the end goes straight to the last", 999, 245, "/pieces?page=5"],
    ["a page that is exactly full", 2, 100, null],
    ["just past an exactly full page", 3, 100, "/pieces?page=2"],
    ["page 2 of one page goes to the first", 2, 50, "/pieces"],
    ["page 201 of a huge list stays", 201, 1_000_000, null],
    ["page 202 of a huge list goes to 201", 202, 1_000_000, "/pieces?page=201"],
  ])("%s", (_why, page, total, expected) => {
    expect(target(page, total)).toBe(expected);
  });
});
