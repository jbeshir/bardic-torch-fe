import {
  COLLECTION_KIND_LABELS,
  ENUMERABLE_LABELS,
} from "~/constants/vocabulary";
import type { CollectionDocument } from "~/editing/documents";
import type { Options } from "~/editing/editor-data";
import {
  CheckboxField,
  labelOptions,
  SelectField,
  TextField,
  MARKDOWN_HELP,
} from "./fields";

/** A collection's fields: its region is an affiliation, its parent a collection. */
export function CollectionForm({
  document,
  options,
}: {
  readonly document: CollectionDocument;
  readonly options: Options;
}) {
  return (
    <>
      <TextField name="name" label="Name" value={document.name} />
      <TextField
        name="url"
        label="Address (URL)"
        type="url"
        value={document.url}
        optional
      />
      <SelectField
        name="kind"
        label="Kind"
        value={document.kind}
        options={labelOptions(COLLECTION_KIND_LABELS)}
      />
      <SelectField
        name="enumerable"
        label="Can its contents be listed?"
        value={document.enumerable}
        options={labelOptions(ENUMERABLE_LABELS)}
      />
      <CheckboxField
        name="is_bardic_resource"
        label="A bardic resource"
        checked={document.is_bardic_resource}
      />
      <SelectField
        name="region_term_slug"
        label="Region"
        value={document.region_term_slug}
        options={options.affiliations ?? []}
        optional
      />
      <SelectField
        name="parent_id"
        label="Part of"
        value={document.parent_id}
        options={options.collections ?? []}
        optional
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
