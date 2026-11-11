import { expect, it } from "vitest";
import { helpFrontmatterSchema } from "./frontmatter";

const VALID = {
  title: "Conservation status",
  description: "How Bardic Torch flags works at risk of being lost.",
  summary: "Some works survive in only one or two places.",
  sourcePages: ["Conservation Status", "Main Page"],
  lastReviewed: "2026-10-31",
};

it.each([
  ["accepts a page's front matter", {}, true],
  ["rejects a missing title", { title: undefined }, false],
  [
    "rejects a description over 160 characters",
    { description: "x".repeat(161) },
    false,
  ],
  ["rejects a date in another form", { lastReviewed: "31/10/2026" }, false],
])("%s", (_name, change, ok) => {
  expect(helpFrontmatterSchema.safeParse({ ...VALID, ...change }).success).toBe(
    ok
  );
});
