import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { updateMeFormSchema, upstreamErrorSchema, userSchema } from "./api";
import { DISPLAY_NAME_RULE } from "./rules";

// Type equality with the generated contract is asserted at compile time in
// api.ts; these tests cover the runtime rules that types cannot express, with
// the limits read from the spec itself.

type Property = { maxLength?: number; minLength?: number };
const schemas = (
  parse(readFileSync("api/openapi.yaml", "utf8")) as {
    components: {
      schemas: Record<string, { properties: Record<string, Property> }>;
    };
  }
).components.schemas;

const DISPLAY_NAME_MAX = schemas.User?.properties.display_name?.maxLength ?? 0;
const DISPLAY_NAME_INPUT_MAX =
  schemas.UpdateMeRequest?.properties.display_name?.maxLength ?? 0;

function messages(result: {
  success: boolean;
  error?: { issues: { message: string }[] };
}) {
  return result.error?.issues.map(issue => issue.message) ?? [];
}

describe("limits read from the spec", () => {
  it("are the ones the copy promises", () => {
    expect([DISPLAY_NAME_MAX, DISPLAY_NAME_INPUT_MAX]).toEqual([64, 256]);
    expect(DISPLAY_NAME_RULE).toBe(
      "Use 1 to 64 characters, without control or invisible formatting characters."
    );
  });
});

describe("updateMeFormSchema", () => {
  it("normalises to NFC and trims, as the API does", () => {
    expect(
      updateMeFormSchema.parse({ display_name: "  Cerdic\u0301  " })
    ).toEqual({
      display_name: "Cerdi\u0107",
    });
  });

  it("counts characters, not UTF-16 code units", () => {
    const astral = "\u{1d11e}".repeat(DISPLAY_NAME_MAX);
    expect(updateMeFormSchema.safeParse({ display_name: astral }).success).toBe(
      true
    );
  });

  it("counts the length after normalising", () => {
    // 64 letters each followed by a combining acute accent: 128 code points
    // before NFC, 64 after.
    const decomposed = "e\u0301".repeat(DISPLAY_NAME_MAX);
    expect(
      updateMeFormSchema.safeParse({ display_name: decomposed }).success
    ).toBe(true);
  });

  it.each([
    [{}, "Enter a display name."],
    [{ display_name: "" }, "Enter a display name."],
    [{ display_name: " \t " }, "Enter a display name."],
    [
      { display_name: "x".repeat(DISPLAY_NAME_MAX + 1) },
      "Display names can be up to 64 characters.",
    ],
    [
      { display_name: ` ${"x".repeat(DISPLAY_NAME_INPUT_MAX)}` },
      "Display names can be up to 64 characters.",
    ],
    [
      { display_name: "Morwen\u202e" },
      "Display names can’t contain control or invisible formatting characters.",
    ],
    [
      { display_name: "Mor\u0000wen" },
      "Display names can’t contain control or invisible formatting characters.",
    ],
    [
      { display_name: "Mor\u00adwen" },
      "Display names can’t contain control or invisible formatting characters.",
    ],
  ])("rejects %j", (input, message) => {
    expect(messages(updateMeFormSchema.safeParse(input))).toEqual([message]);
  });
});

describe("response schemas", () => {
  it("accept the documented shapes", () => {
    expect(
      userSchema.safeParse({
        id: "google-oauth2|123",
        display_name: "Morwen",
        role: "moderator",
      }).success
    ).toBe(true);
    expect(
      upstreamErrorSchema.safeParse({ code: "conflict", message: "y" }).success
    ).toBe(true);
  });

  it.each([
    [
      "an unknown role",
      userSchema,
      { id: "u", display_name: "A", role: "admin" },
    ],
    [
      "an empty display name",
      userSchema,
      { id: "u", display_name: "", role: "contributor" },
    ],
    [
      "an unknown error code",
      upstreamErrorSchema,
      { code: "teapot", message: "y" },
    ],
    ["an error without a message", upstreamErrorSchema, { code: "internal" }],
  ] as const)("reject %s", (_label, schema, value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });
});
