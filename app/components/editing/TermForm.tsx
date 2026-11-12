import { FACET_LABELS } from "~/constants/vocabulary";
import type { TermDocument } from "~/editing/documents";
import type { Options } from "~/editing/editor-data";
import {
  labelOptions,
  Rows,
  SelectField,
  TextField,
  MARKDOWN_HELP,
} from "./fields";

/**
 * A term's fields. A new term needs a parent (plan R-20), so its parent
 * is required there; its parent must be in the same facet (the API checks).
 */
export function TermForm({
  document,
  options,
  isNew,
}: {
  readonly document: TermDocument;
  readonly options: Options;
  readonly isNew: boolean;
}) {
  return (
    <>
      <TextField
        name="display_name"
        label="Name"
        help="As the category shows it: ‘Drinking songs’."
        value={document.display_name}
      />
      <TextField
        name="name"
        label="Full name"
        help="The name with anything that tells it apart from another term of the same name: ‘Story (Mood)’."
        value={document.name}
      />
      <SelectField
        name="facet"
        label="Facet"
        value={document.facet}
        options={labelOptions(FACET_LABELS)}
      />
      <SelectField
        name="parent_slug"
        label="Parent"
        help="A term from the same facet."
        value={document.parent_slug}
        options={options.terms ?? []}
        optional={!isNew}
      />
      <SelectField
        name="related_affiliation_slug"
        label="Related affiliation"
        value={document.related_affiliation_slug}
        options={options.affiliations ?? []}
        optional
      />
      <TextField
        name="position"
        label="Position among its siblings"
        type="number"
        value={document.position}
      />
      <TextField
        name="description_md"
        label="Description"
        help={MARKDOWN_HELP}
        value={document.description_md}
        multiline
        optional
      />
      <Rows
        legend="Other names"
        path="aliases"
        rows={document.aliases}
        rowLabel={index => `Other name ${index + 1}`}
        addLabel="Add another name"
      >
        {(alias, name) => <TextField name={name} label="Name" value={alias} />}
      </Rows>
    </>
  );
}
