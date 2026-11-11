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

describe("characterCount", () => {
  it("counts code points, as the API does, not UTF-16 units", () => {
    expect(characterCount("Ŵyn")).toBe(3);
    expect(characterCount("🎻🎻")).toBe(2);
    expect("🎻🎻".length).toBe(4);
  });
});

describe("normaliseDisplayName", () => {
  it("composes to NFC and trims", () => {
    expect(normaliseDisplayName("  Mórwen\t")).toBe("Mórwen");
    expect(normaliseDisplayName("Mórwen")).toBe("Mórwen");
  });
});

describe("displayNameProblem", () => {
  it.each([
    "Morwen of the Marches",
    "x".repeat(DISPLAY_NAME_MAX),
    ` ${"x".repeat(DISPLAY_NAME_MAX)} `,
    "é".repeat(DISPLAY_NAME_MAX),
    "🎻".repeat(DISPLAY_NAME_MAX),
  ])("accepts %j", value => {
    expect(displayNameProblem(value)).toBeNull();
  });

  it.each([
    [undefined, "Enter a display name."],
    ["", "Enter a display name."],
    [" \t\n", "Enter a display name."],
    [
      "x".repeat(DISPLAY_NAME_MAX + 1),
      "Display names can be up to 64 characters.",
    ],
    [
      `${" ".repeat(250)}Morwen${" ".repeat(10)}`,
      "Display names can be up to 64 characters.",
    ],
    [
      "Morwen\u202e",
      "Display names can’t contain control or invisible formatting characters.",
    ],
    [
      "Mor\u200bwen",
      "Display names can’t contain control or invisible formatting characters.",
    ],
    [
      "Mor\u0007wen",
      "Display names can’t contain control or invisible formatting characters.",
    ],
  ])("rejects %j: %s", (value, message) => {
    expect(displayNameProblem(value)).toBe(message);
  });
});

describe("updateMeFormSchema", () => {
  const TOO_LONG = "Display names can be up to 64 characters.";
  const INVISIBLE =
    "Display names can’t contain control or invisible formatting characters.";

  it.each([
    ["trims and normalises to NFC", "  Cerdic\u0301  ", "Cerdi\u0107"],
    ["counts characters, not UTF-16 units", "\u{1d11e}".repeat(64), undefined],
    ["counts after normalising", "e\u0301".repeat(64), undefined],
  ])("accepts a name that %s", (_label, input, expected) => {
    const parsed = updateMeFormSchema.parse({ display_name: input });
    expect(parsed.display_name).toBe(expected ?? input.normalize("NFC"));
  });

  it.each([
    [{}, "Enter a display name."],
    [{ display_name: " \t " }, "Enter a display name."],
    [{ display_name: "x".repeat(65) }, TOO_LONG],
    [{ display_name: "Morwen\u202e" }, INVISIBLE],
    [{ display_name: "Mor\u0000wen" }, INVISIBLE],
  ])("rejects %j", (input, message) => {
    const result = updateMeFormSchema.safeParse(input);
    expect(result.error?.issues.map(issue => issue.message)).toEqual([message]);
  });
});
