import type { components } from "~/api/schema.gen";
import { fieldId } from "./form-codec";

/**
 * Our copy for the API's 422 problems (CLAUDE.md rule 5): one message per
 * `ProblemCode`, shown under the field and, after the field's name, in the
 * error summary.
 */

type Schemas = components["schemas"];

const PROBLEM_MESSAGES: Readonly<Record<Schemas["ProblemCode"], string>> = {
  required: "This is needed. Fill it in.",
  too_long: "This is too long. Shorten it.",
  not_nfc: "This has characters we can’t store as typed. Type them again.",
  control_character: "This has a hidden control character. Type it again.",
  duplicate: "This is listed twice. Remove one of them.",
  invalid: "This isn’t in a form we can use. Check it.",
  cycle: "This would put the page inside itself. Choose another.",
  too_deep: "This goes too many levels deep. Choose one higher up.",
  wrong_facet: "This is in another facet. Choose one from the same facet.",
  unknown_reference:
    "We couldn’t find this in the catalogue. Choose another, or leave it out.",
  source_required: "This needs a source. Add a link to it.",
  prefers_no_page:
    "This person asked not to have a page, so only a moderator can add them.",
};

/** A problem as the form shows it: at its control, with our words. */
export type FieldProblem = {
  readonly fieldId: string;
  /** The field, for the summary: `Credits 3, person`. */
  readonly field: string;
  readonly message: string;
};

/** A path read as words: `credits[2].person_slug` → `Credits 3, person`. */
function fieldName(path: string): string {
  const words = fieldId(path)
    .split(".")
    .map(key =>
      /^\d+$/.test(key)
        ? String(Number(key) + 1)
        : `, ${key.replace(/_(slugs?|md|id)$/, "").replaceAll("_", " ")}`
    )
    .join(" ")
    .replace(/ ,/g, ",")
    .slice(2);
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A credit's typed name, whose `invalid` is a person given both ways. */
const NEW_PERSON_NAME = /^credits\[\d+\]\.new_person_name$/;

export function fieldProblem({ path, code }: Schemas["Problem"]): FieldProblem {
  return {
    fieldId: fieldId(path),
    field: fieldName(path),
    message:
      code === "invalid" && NEW_PERSON_NAME.test(path)
        ? "Choose a person from the list or type a name, not both."
        : (PROBLEM_MESSAGES[code] ?? PROBLEM_MESSAGES.invalid),
  };
}

/**
 * The problems the form finds itself before it submits, as the API would
 * report them (so they show with the same copy): a credit to a person from
 * the list that also types a new person's name.
 */
export const documentProblems = (
  document: Schemas["EditorDocument"]
): Schemas["Problem"][] =>
  ("credits" in document ? document.credits : []).flatMap((credit, index) =>
    credit.person_slug !== null && credit.new_person_name !== null
      ? [{ path: `credits[${index}].new_person_name`, code: "invalid" }]
      : []
  );
