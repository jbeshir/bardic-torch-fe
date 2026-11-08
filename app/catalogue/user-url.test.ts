import { describe, expect, it } from "vitest";
import { isUserUrl } from "./user-url";

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
