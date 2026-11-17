import {
  ATTRIBUTION_LABELS,
  CERTAINTY_QUALIFIERS,
  CREDIT_ROLE_LABELS,
} from "~/constants/vocabulary";
import type { PieceDocument } from "~/editing/documents";
import type { Option } from "~/editing/editor-data";
import { labelOptions, Rows, SelectField, TextField } from "./fields";

const ATTRIBUTIONS = [
  { value: "named", label: "Named: the person above" },
  ...labelOptions(ATTRIBUTION_LABELS),
];

const CERTAINTIES = [
  { value: "certain", label: "Certain" },
  ...labelOptions(CERTAINTY_QUALIFIERS),
];

/** A piece's credits: who made what, and how sure we are. */
export function CreditEditor({
  credits,
  persons,
}: {
  readonly credits: PieceDocument["credits"];
  readonly persons: readonly Option[];
}) {
  return (
    <Rows
      legend="Credits"
      path="credits"
      rows={credits}
      rowLabel={index => `Credit ${index + 1}`}
      addLabel="Add a credit"
    >
      {(credit, name) => (
        <>
          <SelectField
            name={`${name}.person_slug`}
            label="Person"
            help="Leave it as None for a traditional, unknown or anonymous credit."
            value={credit.person_slug}
            options={persons}
            optional
          />
          <TextField
            name={`${name}.new_person_name`}
            label="Name, if not in the list"
            help="Leave the person as None. When a moderator approves the edit, the name is linked to the bard of that name, or added as a stub page."
            value={credit.new_person_name}
            optional
          />
          <SelectField
            name={`${name}.role`}
            label="Role"
            value={credit.role}
            options={labelOptions(CREDIT_ROLE_LABELS)}
          />
          <SelectField
            name={`${name}.attribution`}
            label="Attribution"
            value={credit.attribution}
            options={ATTRIBUTIONS}
          />
          <SelectField
            name={`${name}.certainty`}
            label="Certainty"
            value={credit.certainty}
            options={CERTAINTIES}
          />
        </>
      )}
    </Rows>
  );
}
