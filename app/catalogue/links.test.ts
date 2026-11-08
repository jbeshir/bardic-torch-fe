import { describe, expect, it } from "vitest";
import { isWebUrl } from "./links";

describe("isWebUrl", () => {
  it.each([
    ["https://video.example/watch", true],
    ["HTTP://old.example", true],
    ["javascript:alert(1)", false],
    ["mailto:bard@example.org", false],
    ["//video.example", false],
    ["video.example", false],
  ])("reads %j as %s", (url, web) => {
    expect(isWebUrl(url)).toBe(web);
  });
});
