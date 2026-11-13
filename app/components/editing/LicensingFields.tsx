import { LICENSING_STATUS_LABELS } from "~/constants/vocabulary";
import { labelOptions, MARKDOWN_HELP, SelectField, TextField } from "./fields";

/** The help on licensing: a change needs a link that sources it. */
const LICENSING_HELP =
  "A change to the licensing needs a source: one of the links with the role ‘Licensing source’.";

/** Whether the licensing is known, and the notes on it. */
export function LicensingFields({
  status,
  notes,
}: {
  readonly status: keyof typeof LICENSING_STATUS_LABELS;
  readonly notes: string | null;
}) {
  return (
    <>
      <SelectField
        name="licensing_status"
        label="Licensing"
        help={LICENSING_HELP}
        value={status}
        options={labelOptions(LICENSING_STATUS_LABELS)}
      />
      <TextField
        name="licensing_notes_md"
        label="Licensing notes"
        help={MARKDOWN_HELP}
        value={notes}
        multiline
        optional
      />
    </>
  );
}
