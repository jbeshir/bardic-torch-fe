import { describe, expect, it } from "vitest";
import {
  isBeyondApi,
  isCapped,
  pageCount,
  showingText,
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

describe("showingText", () => {
  it("is the count alone when one page holds the list", () => {
    expect(showingText(1, 12, 12, "piece")).toBe("Showing 12 pieces");
    expect(showingText(1, 1, 1, "bard")).toBe("Showing 1 bard");
  });

  it("is the page's range of the total, so each page reads differently", () => {
    expect(showingText(1, 50, 249, "piece")).toBe("Showing 1–50 of 249 pieces");
    expect(showingText(2, 50, 249, "piece")).toBe(
      "Showing 51–100 of 249 pieces"
    );
    expect(showingText(5, 49, 249, "piece")).toBe(
      "Showing 201–249 of 249 pieces"
    );
  });

  it("takes an irregular plural, and formats big numbers", () => {
    expect(
      showingText(3, 50, 12000, "event or venue", "events and venues")
    ).toBe("Showing 101–150 of 12,000 events and venues");
  });
});
