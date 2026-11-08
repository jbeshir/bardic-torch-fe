import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { isEntityId, isSlug, MAX_PAGE, PAGE_SIZE } from "./address";

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
const offset = parameters["Offset"]?.schema ?? {};
const slug = parameters["Slug"]?.schema ?? {};

describe("paging limits", () => {
  it("pages by the API's default limit", () => {
    expect(PAGE_SIZE).toBe(limit.default);
  });

  it("stops at the last page whose offset the API accepts", () => {
    const maxOffset = offset.maximum ?? 0;
    expect((MAX_PAGE - 1) * PAGE_SIZE).toBeLessThanOrEqual(maxOffset);
    expect(MAX_PAGE * PAGE_SIZE).toBeGreaterThan(maxOffset);
    expect(MAX_PAGE).toBe(201);
  });
});

describe("isSlug", () => {
  const pattern = new RegExp(slug.pattern ?? "");
  const max = slug.maxLength ?? 0;

  it.each([
    "war",
    "the-copper-kettle",
    "12th-century",
    "a",
    "a".repeat(max),
    "a-".repeat(95) + "a",
    "",
    "War",
    "war-",
    "-war",
    "war--songs",
    "war_songs",
    "war/songs",
    "..",
    "é",
    "war songs",
    "a".repeat(max + 1),
  ])("agrees with the spec's pattern and length for %j", value => {
    expect(isSlug(value)).toBe(pattern.test(value) && value.length <= max);
  });

  it("is the 191-character slug rule", () => {
    expect(max).toBe(191);
    expect(isSlug("a".repeat(191))).toBe(true);
    expect(isSlug("a".repeat(192))).toBe(false);
  });
});

describe("isEntityId (collections and revisions)", () => {
  const id = parameters["CollectionID"]?.schema ?? {};
  const revision = parameters["RevisionID"]?.schema ?? {};

  it("is the spec's id: an int64 from 1", () => {
    expect(id.minimum).toBe(1);
    expect(revision.minimum).toBe(1);
  });

  it.each([
    ["1", true],
    ["12", true],
    ["9223372036854775807", true],
    ["9223372036854775808", false],
    ["99999999999999999999", false],
    ["0", false],
    ["01", false],
    ["-1", false],
    ["+1", false],
    ["1.0", false],
    ["abc", false],
    ["", false],
    [" 1", false],
  ])("reads %j as %s", (value, valid) => {
    expect(isEntityId(value)).toBe(valid);
  });
});
