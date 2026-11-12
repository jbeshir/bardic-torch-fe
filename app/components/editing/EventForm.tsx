import { EVENT_KIND_LABELS } from "~/constants/vocabulary";
import type { EventDocument } from "~/editing/documents";
import { labelOptions, SelectField, TextField, MARKDOWN_HELP } from "./fields";

/** An event's or venue's fields. */
export function EventForm({ document }: { readonly document: EventDocument }) {
  return (
    <>
      <TextField name="name" label="Name" value={document.name} />
      <SelectField
        name="kind"
        label="Kind"
        value={document.kind}
        options={labelOptions(EVENT_KIND_LABELS)}
      />
      <TextField
        name="description_md"
        label="Description"
        help={MARKDOWN_HELP}
        value={document.description_md}
        multiline
        optional
      />
    </>
  );
}
