import type { ReactNode } from "react";
import { LICENSING_STATUS_LABELS } from "~/constants/vocabulary";
import type { Option } from "~/editing/editor-data";
import { labelOptions, MARKDOWN_HELP, SelectField, TextField } from "./fields";

/**
 * A status and, optionally, the address of a page that shows it.
 */
export function SourcedField({
  legend,
  name,
  value,
  options,
  sourceName,
  sourceValue,
  children,
}: {
  readonly legend: string;
  readonly name: string;
  readonly value: string;
  readonly options: readonly Option[];
  readonly sourceName: string;
  readonly sourceValue: string | null;
  /** More fields between the two (a person's status date). */
  readonly children?: ReactNode;
}) {
  return (
    <fieldset className="grid gap-5">
      <legend className="mb-3 text-body-sm font-semibold text-fg">
        {legend}
      </legend>
      <SelectField name={name} label="Status" value={value} options={options} />
      {children}
      <TextField
        name={sourceName}
        label="Source (URL)"
        type="url"
        help="A page that shows it."
        value={sourceValue}
        optional
      />
    </fieldset>
  );
}

/** The help on licensing: a change needs a link that sources it. */
const LICENSING_HELP =
  "A change to the licensing needs a source: one of the links with the role ‘Licensing source’.";

/** Whether the licensing is known, and the notes on it. */
export function LicensingFields({
  status,
  notes,
  children,
}: {
  readonly status: keyof typeof LICENSING_STATUS_LABELS;
  readonly notes: string | null;
  /** A piece's licence and its version. */
  readonly children?: ReactNode;
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
      {children}
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
