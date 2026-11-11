import { describe, expect, it } from "vitest";
import { updateMeFormSchema } from "./api";
import {
  characterCount,
  DISPLAY_NAME_MAX,
  displayNameProblem,
  normaliseDisplayName,
} from "./rules";

// The shared rules both the proxy (through zod, see `updateMeFormSchema`) and the
// settings forms in the browser check with.

const TOO_LONG = "Display names can be up to 64 characters.";
const INVISIBLE =
  "Display names can’t contain control or invisible formatting characters.";

it("counts code points, as the API does, not UTF-16 units", () => {
  expect(characterCount("🎻🎻")).toBe(2);
});

it("normalises a display name to NFC and trims it", () => {
  expect(normaliseDisplayName("  Mórwen\t")).toBe("Mórwen");
});

describe("displayNameProblem", () => {
  it.each([
    "Morwen of the Marches",
    ` ${"x".repeat(DISPLAY_NAME_MAX)} `,
    "🎻".repeat(DISPLAY_NAME_MAX),
  ])("accepts %j", value => {
    expect(displayNameProblem(value)).toBeNull();
  });

  it.each([
    [undefined, "Enter a display name."],
    [" \t\n", "Enter a display name."],
    ["x".repeat(DISPLAY_NAME_MAX + 1), TOO_LONG],
    ["Morwen‮", INVISIBLE],
    ["Mor​wen", INVISIBLE],
  ])("rejects %j: %s", (value, message) => {
    expect(displayNameProblem(value)).toBe(message);
  });
});

describe("updateMeFormSchema", () => {
  it.each([
    ["trims and normalises to NFC", "  Cerdić  ", "Cerdić"],
    ["counts after normalising", "é".repeat(64), "é".repeat(64)],
  ])("accepts a name that %s", (_label, input, expected) => {
    expect(updateMeFormSchema.parse({ display_name: input }).display_name).toBe(
      expected
    );
  });

  it.each([
    [{}, "Enter a display name."],
    [{ display_name: "x".repeat(65) }, TOO_LONG],
    [{ display_name: "Mor\u0000wen" }, INVISIBLE],
  ])("rejects %j", (input, message) => {
    const result = updateMeFormSchema.safeParse(input);
    expect(result.error?.issues.map(issue => issue.message)).toEqual([message]);
  });
});
