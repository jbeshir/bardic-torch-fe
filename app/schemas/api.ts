import { z } from "zod";
import type { components } from "~/api/schema.gen";
import { type Assert, type Matches } from "./contract";
import {
  characterCount,
  DISPLAY_NAME_MAX,
  displayNameProblem,
  normaliseDisplayName,
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
  "method_not_allowed",
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

export type User = z.output<typeof userSchema>;
export type UpstreamErrorCode = z.output<typeof errorCodeSchema>;

// Compile-time contract checks: each schema's output must equal the generated
// type in both directions (see `Matches`).
type _ContractChecks = [
  Assert<Matches<typeof roleSchema, Schemas["User"]["role"]>>,
  Assert<Matches<typeof errorCodeSchema, Schemas["Error"]["code"]>>,
  Assert<Matches<typeof userSchema, Schemas["User"]>>,
  Assert<Matches<typeof upstreamErrorSchema, Schemas["Error"]>>,
  Assert<Matches<typeof updateMeFormSchema, Schemas["UpdateMeRequest"]>>,
];
