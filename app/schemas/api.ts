import { z } from "zod";
import type { components } from "~/api/schema.gen";
import { displayNameProblem, normaliseDisplayName } from "./rules";

/**
 * The form body the `PATCH /api/me` proxy route accepts (zod: it is input),
 * and the API's `User` and error-code types, generated from the spec. The
 * field rules live in `rules.ts`, which the UI shares.
 */

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

export type User = components["schemas"]["User"];
export type UpstreamErrorCode = components["schemas"]["Error"]["code"];
