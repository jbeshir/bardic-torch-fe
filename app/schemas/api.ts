import { z } from "zod";
import type { components } from "~/api/schema.gen";
import {
  characterCount,
  DISPLAY_NAME_MAX,
  displayNameProblem,
  normaliseDisplayName,
  TOKEN_NAME_MAX,
  tokenNameProblem,
} from "./rules";

/**
 * Runtime schemas for the Bardic Torch API, checked at compile time against
 * the types generated from `api/openapi.yaml`, plus the form bodies the
 * `/api/*` proxy routes accept. The field rules they check live in
 * `rules.ts`, which the UI shares.
 */

type Schemas = components["schemas"];

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

const timestamp = z.iso.datetime({ offset: true });

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

/** A zod refinement that reports `problem(value)` as the issue. */
function checkedBy<T>(problem: (value: T) => string | null) {
  return (value: T, context: z.RefinementCtx) => {
    const message = problem(value);
    if (message !== null) context.addIssue({ code: "custom", message });
  };
}

/**
 * Form body of `PATCH /api/me`. The name is checked with the shared rule,
 * then NFC-normalised and trimmed, as the API does, so the proxy rejects
 * what the API would reject.
 */
export const updateMeFormSchema = z.object({
  display_name: z
    .string()
    .optional()
    .superRefine(checkedBy(displayNameProblem))
    .transform(value => normaliseDisplayName(value ?? "")),
});

/** Form body of `POST /api/tokens`; a blank name means no name. */
export const createApiTokenFormSchema = z
  .object({
    name: z.string().superRefine(checkedBy(tokenNameProblem)).optional(),
  })
  .transform(({ name }): Schemas["CreateAPITokenRequest"] => {
    const trimmed = name?.trim();
    return trimmed ? { name: trimmed } : {};
  });

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
type Matches<S extends z.ZodType, Generated> = Equals<
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
