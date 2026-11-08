import { describe, expect, it } from "vitest";
import { isUserUrl, urlHost } from "./user-url";

describe("isUserUrl", () => {
  it.each([
    "https://example.org/wren",
    "http://example.org",
    "https://archive.example/2026/https://example.org/x?y=1#z",
  ])("lets %s be a link", url => {
    expect(isUserUrl(url)).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "data:text/html,<script>",
    "/pieces/the-copper-kettle",
    "//example.org",
    "mailto:wren@example.org",
    "https://",
    "example.org",
    "",
  ])("keeps %s as text", url => {
    expect(isUserUrl(url)).toBe(false);
  });
});

describe("urlHost", () => {
  it.each([
    ["https://collections.example/12", "collections.example"],
    ["https://www.example.org/a/b?c=1", "example.org"],
    ["http://sub.example.org:8080/", "sub.example.org"],
  ])("labels %s as %s", (url, host) => {
    expect(urlHost(url)).toBe(host);
  });

  it("returns what isn't a URL as it is", () => {
    expect(urlHost("not a url")).toBe("not a url");
  });
});
