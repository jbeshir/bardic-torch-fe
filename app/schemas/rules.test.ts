import { describe, expect, it } from "vitest";
import {
  characterCount,
  DISPLAY_NAME_MAX,
  displayNameProblem,
  normaliseDisplayName,
  TOKEN_NAME_MAX,
  tokenNameProblem,
} from "./rules";

// The shared rules both the proxy (through zod, see api.test.ts) and the
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
      "Display names can't contain control or invisible formatting characters.",
    ],
    [
      "Mor\u200bwen",
      "Display names can't contain control or invisible formatting characters.",
    ],
    [
      "Mor\u0007wen",
      "Display names can't contain control or invisible formatting characters.",
    ],
  ])("rejects %j: %s", (value, message) => {
    expect(displayNameProblem(value)).toBe(message);
  });
});

describe("tokenNameProblem", () => {
  it.each(["", "   ", "Laptop MCP", ` ${"x".repeat(TOKEN_NAME_MAX)} `])(
    "accepts %j",
    value => {
      expect(tokenNameProblem(value)).toBeNull();
    }
  );

  it("rejects a name over 128 characters after trimming", () => {
    expect(tokenNameProblem("x".repeat(TOKEN_NAME_MAX + 1))).toBe(
      "Token names can be up to 128 characters."
    );
  });
});
