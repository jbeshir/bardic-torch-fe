import {
  PERSON_ALIAS_KIND_LABELS,
  PERSON_KIND_LABELS,
  PERSON_RELATION_LABELS,
  PERSON_ROLE_LABELS,
  PERSON_STATUS_LABELS,
} from "~/constants/vocabulary";
import type { PersonDocument } from "~/editing/documents";
import type { Options, Picker } from "~/editing/editor-data";
import {
  CheckboxField,
  ChoicesField,
  FormSection,
  labelOptions,
  MARKDOWN_HELP,
  MultiSelectField,
  relationOptions,
  Rows,
  SelectField,
  TextField,
} from "./fields";
import { LinkEditor } from "./LinkEditor";
import { LicensingFields, SourcedField } from "./SourcedField";

/** The lists the person form picks from, and its preview names from. */
export const PERSON_PICKERS: readonly Picker[] = [
  "persons",
  "pieces",
  "events",
  "affiliations",
  "collections",
];

/** A person's fields, in sections in the order their page shows them. */
export function PersonForm({
  document,
  options,
}: {
  readonly document: PersonDocument;
  readonly options: Options;
}) {
  return (
    <>
      <FormSection title="The person">
        <TextField name="name" label="Name" value={document.name} />
        <SelectField
          name="kind"
          label="Kind"
          value={document.kind}
          options={labelOptions(PERSON_KIND_LABELS)}
        />
        <TextField
          name="pronouns"
          label="Pronouns"
          value={document.pronouns}
          optional
        />
        <SourcedField
          legend="Status"
          name="status"
          value={document.status}
          options={labelOptions(PERSON_STATUS_LABELS)}
          exempt={PERSON_STATUS_LABELS.active}
          sourceName="status_source_url"
          sourceValue={document.status_source_url}
        >
          <TextField
            name="status_date"
            label="Since"
            help="As year-month-day: ‘2026-03-01’."
            value={document.status_date}
            optional
          />
        </SourcedField>
        <Rows
          legend="Other names"
          path="aliases"
          rows={document.aliases}
          rowLabel={index => `Other name ${index + 1}`}
          addLabel="Add another name"
        >
          {(alias, name) => (
            <>
              <TextField
                name={`${name}.name`}
                label="Name"
                value={alias.name}
              />
              <SelectField
                name={`${name}.kind`}
                label="Kind"
                value={alias.kind}
                options={labelOptions(PERSON_ALIAS_KIND_LABELS)}
              />
            </>
          )}
        </Rows>
        <ChoicesField
          name="roles"
          legend="Roles"
          values={document.roles}
          options={labelOptions(PERSON_ROLE_LABELS)}
        />
        <MultiSelectField
          name="affiliation_slugs"
          label="Affiliations"
          values={document.affiliation_slugs}
          options={options.affiliations ?? []}
          optional
        />
        <CheckboxField
          name="is_stub"
          label="A stub: the page needs more"
          checked={document.is_stub}
        />
        <TextField
          name="notes_md"
          label="About"
          help={MARKDOWN_HELP}
          value={document.notes_md}
          multiline
          optional
        />
      </FormSection>
      <FormSection title="Licensing">
        <LicensingFields
          status={document.licensing_status}
          notes={document.licensing_notes_md}
        />
      </FormSection>
      <FormSection title="Relations and links">
        <Rows
          legend="Relations"
          path="relations"
          rows={document.relations}
          rowLabel={index => `Relation ${index + 1}`}
          addLabel="Add a relation"
        >
          {(relation, name) => (
            <>
              <SelectField
                name={`${name}.type`}
                label="Relation"
                value={relation.type}
                options={relationOptions(PERSON_RELATION_LABELS)}
              />
              <SelectField
                name={`${name}.to_person_slug`}
                label="Person"
                value={
                  relation.to_person_slug === ""
                    ? null
                    : relation.to_person_slug
                }
                options={options.persons ?? []}
              />
            </>
          )}
        </Rows>
        <LinkEditor links={document.links} options={options} ofPerson />
      </FormSection>
    </>
  );
}
