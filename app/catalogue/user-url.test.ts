import { describe, expect, it } from "vitest";
import { isUserUrl, urlHost } from "./user-url";

describe("isUserUrl", () => {
  it.each([
    ["https://example.org/wren", true],
    ["javascript:alert(1)", false],
    ["JAVASCRIPT:alert(1)", false],
    ["data:text/html,<script>", false],
    ["/pieces/the-copper-kettle", false],
    ["//example.org", false],
    ["https://", false],
    ["", false],
  ])("%s is %s", (url, expected) => {
    expect(isUserUrl(url)).toBe(expected);
  });

  it("labels a URL by its host without www, and returns a non-URL as it is", () => {
    expect(urlHost("https://www.example.org/a?c=1")).toBe("example.org");
    expect(urlHost("not a url")).toBe("not a url");
  });
});
