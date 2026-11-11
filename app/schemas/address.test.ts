import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { isEntityId, isSlug, PAGE_SIZE } from "./address";

// The paging limits and the slug rule, read from the spec itself, so the
// constants can't drift from it.

type Schema = {
  minimum?: number;
  maximum?: number;
  default?: number;
  pattern?: string;
  maxLength?: number;
};
const parameters = (
  parse(readFileSync("api/openapi.yaml", "utf8")) as {
    components: { parameters: Record<string, { schema: Schema }> };
  }
).components.parameters;

const limit = parameters["Limit"]?.schema ?? {};
const slug = parameters["Slug"]?.schema ?? {};

it("pages by the API's default limit", () => {
  expect(PAGE_SIZE).toBe(limit.default);
});

describe("isSlug", () => {
  const pattern = new RegExp(slug.pattern ?? "");
  const max = slug.maxLength ?? 0;

  it.each([
    "the-copper-kettle",
    "12th-century",
    "a".repeat(max),
    "",
    "War",
    "war-",
    "war--songs",
    "war_songs",
    "..",
    "é",
    "a".repeat(max + 1),
  ])("agrees with the spec's pattern and length for %j", value => {
    expect(isSlug(value)).toBe(pattern.test(value) && value.length <= max);
  });
});

describe("isEntityId (collections and revisions)", () => {
  it.each([
    ["1", true],
    ["9223372036854775807", true],
    ["9223372036854775808", false],
    ["0", false],
    ["01", false],
    ["-1", false],
    ["1.0", false],
    ["", false],
  ])("reads %j as %s", (value, valid) => {
    expect(isEntityId(value)).toBe(valid);
  });
});
