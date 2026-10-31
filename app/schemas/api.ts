import { z } from "zod";
import type { components } from "~/api/schema.gen";

/**
 * Runtime schemas for the Bardic Torch API, checked at compile time against
 * the types generated from `api/openapi.yaml`, plus the form bodies the
 * `/api/*` proxy routes accept and the rules they share with the UI.
 */

type Schemas = components["schemas"];

/** Longest display name the API keeps, in characters, after normalising. */
const DISPLAY_NAME_MAX = 64;
/** Longest display name the API reads, in characters, before normalising. */
const DISPLAY_NAME_INPUT_MAX = 256;
/** Longest API token name the API keeps, in characters, after trimming. */
const TOKEN_NAME_MAX = 128;
/** How many active API tokens one user may have. */
export const ACTIVE_TOKEN_LIMIT = 10;

/** The display-name rule as UI copy, for hints and upstream rejections. */
export const DISPLAY_NAME_RULE = `Use 1 to ${DISPLAY_NAME_MAX} characters, without control or invisible formatting characters.`;
/** The token-name rule as UI copy. */
export const TOKEN_NAME_RULE = `Use ${TOKEN_NAME_MAX} characters or fewer, or leave the name blank.`;

/** Unicode control (Cc) and format (Cf) characters, such as U+202E. */
const CONTROL_OR_FORMAT = /[\p{Cc}\p{Cf}]/u;

/** Length in characters (code points), as the API counts it. */
function characterCount(value: string): number {
  return [...value].length;
}

/** A string of `min` to `max` characters, as JSON Schema counts them. */
function characters(min: number, max: number) {
  return z.string().refine(value => {
    const count = characterCount(value);
    return count >= min && count <= max;
  });
}

const roleSchema = z.enum(["contributor", "moderator"]);

const errorCodeSchema = z.enum([
  "invalid_request",
  "unsupported_media_type",
  "request_too_large",
  "unauthenticated",
  "user_blocked",
  "api_token_not_allowed",
  "moderator_required",
  "not_found",
  "conflict",
  "token_limit_reached",
  "internal",
  "unavailable",
]);

export const userSchema = z.object({
  id: z.string(),
  display_name: characters(1, DISPLAY_NAME_MAX),
  role: roleSchema,
});

const timestamp = z.string().datetime({ offset: true });

const apiTokenSchema = z.object({
  id: z.string(),
  prefix: z.string().regex(/^[0-9a-f]{8}$/),
  name: characters(1, TOKEN_NAME_MAX).nullable(),
  created_at: timestamp,
  last_used_at: timestamp.nullable(),
});

export const apiTokenListSchema = z.object({ data: z.array(apiTokenSchema) });

export const createdApiTokenSchema = apiTokenSchema.extend({
  token: z.string().regex(/^user_api\|[0-9a-f]{64}$/),
});

/** An upstream error body. Its `message` is never shown to users. */
export const upstreamErrorSchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
});

/**
 * Form body of `PATCH /api/me`. The name is NFC-normalised and trimmed, as
 * the API does, so the proxy rejects what the API would reject.
 */
export const updateMeFormSchema = z.object({
  display_name: z
    .string({ required_error: "Enter a display name." })
    .refine(value => characterCount(value) <= DISPLAY_NAME_INPUT_MAX, {
      message: `Enter a display name of ${DISPLAY_NAME_MAX} characters or fewer.`,
    })
    .transform(value => value.normalize("NFC").trim())
    .refine(value => value !== "", { message: "Enter a display name." })
    .refine(value => characterCount(value) <= DISPLAY_NAME_MAX, {
      message: `Enter a display name of ${DISPLAY_NAME_MAX} characters or fewer.`,
    })
    .refine(value => !CONTROL_OR_FORMAT.test(value), {
      message:
        "Remove control or invisible formatting characters from the display name.",
    }),
});

/** Form body of `POST /api/tokens`; a blank name means no name. */
export const createApiTokenFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .refine(value => characterCount(value) <= TOKEN_NAME_MAX, {
        message: `Enter a token name of ${TOKEN_NAME_MAX} characters or fewer.`,
      })
      .optional(),
  })
  .transform(({ name }): Schemas["CreateAPITokenRequest"] =>
    name ? { name } : {}
  );

export type User = z.output<typeof userSchema>;
export type UpstreamErrorCode = z.output<typeof errorCodeSchema>;

// Compile-time contract checks: each schema's output must equal the generated
// type in both directions. zod types optional keys as `?: T | undefined`,
// which `exactOptionalPropertyTypes` tells apart from the generated `?: T`;
// the spec never sends `undefined`, so that difference is removed first.
type WithoutUndefined<T> = T extends object
  ? { [K in keyof T]: WithoutUndefined<Exclude<T[K], undefined>> }
  : T;
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Matches<S extends z.ZodTypeAny, Generated> = Equals<
  WithoutUndefined<z.output<S>>,
  WithoutUndefined<Generated>
>;
type Assert<T extends true> = T;

type _ContractChecks = [
  Assert<Matches<typeof roleSchema, Schemas["User"]["role"]>>,
  Assert<Matches<typeof errorCodeSchema, Schemas["Error"]["code"]>>,
  Assert<Matches<typeof userSchema, Schemas["User"]>>,
  Assert<Matches<typeof apiTokenSchema, Schemas["APIToken"]>>,
  Assert<Matches<typeof apiTokenListSchema, Schemas["APITokenList"]>>,
  Assert<Matches<typeof createdApiTokenSchema, Schemas["CreatedAPIToken"]>>,
  Assert<Matches<typeof upstreamErrorSchema, Schemas["Error"]>>,
  Assert<Matches<typeof updateMeFormSchema, Schemas["UpdateMeRequest"]>>,
  Assert<
    Matches<typeof createApiTokenFormSchema, Schemas["CreateAPITokenRequest"]>
  >,
];
