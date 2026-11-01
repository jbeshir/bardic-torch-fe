import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  apiTokenListSchema,
  createApiTokenFormSchema,
  createdApiTokenSchema,
  updateMeFormSchema,
  upstreamErrorSchema,
  userSchema,
} from "./api";
import { DISPLAY_NAME_RULE, TOKEN_NAME_RULE } from "./rules";

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
const TOKEN_NAME_MAX = schemas.APIToken?.properties.name?.maxLength ?? 0;

const token = {
  id: "6f1c1f0e-8a4b-4f43-9a5e-2d7c0b1e3a55",
  prefix: "0123abcd",
  name: "Laptop",
  created_at: "2026-01-01T00:00:00Z",
  last_used_at: null,
};

function messages(result: {
  success: boolean;
  error?: { issues: { message: string }[] };
}) {
  return result.error?.issues.map(issue => issue.message) ?? [];
}

describe("limits read from the spec", () => {
  it("are the ones the copy promises", () => {
    expect([DISPLAY_NAME_MAX, DISPLAY_NAME_INPUT_MAX, TOKEN_NAME_MAX]).toEqual([
      64, 256, 128,
    ]);
    expect(DISPLAY_NAME_RULE).toBe(
      "Use 1 to 64 characters, without control or invisible formatting characters."
    );
    expect(TOKEN_NAME_RULE).toBe(
      "Use 128 characters or fewer, or leave the name blank."
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
      "Display names can't contain control or invisible formatting characters.",
    ],
    [
      { display_name: "Mor\u0000wen" },
      "Display names can't contain control or invisible formatting characters.",
    ],
    [
      { display_name: "Mor\u00adwen" },
      "Display names can't contain control or invisible formatting characters.",
    ],
  ])("rejects %j", (input, message) => {
    expect(messages(updateMeFormSchema.safeParse(input))).toEqual([message]);
  });
});

describe("createApiTokenFormSchema", () => {
  it.each([
    [{}, {}],
    [{ name: "" }, {}],
    [{ name: "   " }, {}],
    [{ name: " Laptop " }, { name: "Laptop" }],
  ])("turns %j into %j", (input, output) => {
    expect(createApiTokenFormSchema.parse(input)).toEqual(output);
  });

  it("allows exactly the maximum and rejects one more", () => {
    expect(
      createApiTokenFormSchema.safeParse({ name: "x".repeat(TOKEN_NAME_MAX) })
        .success
    ).toBe(true);
    expect(
      messages(
        createApiTokenFormSchema.safeParse({
          name: "x".repeat(TOKEN_NAME_MAX + 1),
        })
      )
    ).toEqual(["Token names can be up to 128 characters."]);
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
    expect(apiTokenListSchema.safeParse({ data: [token] }).success).toBe(true);
    expect(
      createdApiTokenSchema.safeParse({
        ...token,
        token: `user_api|${"0123abcd".repeat(8)}`,
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
      "a non-ISO date",
      apiTokenListSchema,
      { data: [{ ...token, created_at: "1 Jan" }] },
    ],
    [
      "a missing nullable",
      apiTokenListSchema,
      { data: [{ ...token, last_used_at: undefined }] },
    ],
    [
      "an uppercase prefix",
      apiTokenListSchema,
      { data: [{ ...token, prefix: "0123ABCD" }] },
    ],
    [
      "a secret without its prefix",
      createdApiTokenSchema,
      { ...token, token: "0123abcd".repeat(8) },
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

  it("accepts dates with an offset", () => {
    expect(
      apiTokenListSchema.safeParse({
        data: [{ ...token, last_used_at: "2026-02-01T10:00:00+01:00" }],
      }).success
    ).toBe(true);
  });
});
