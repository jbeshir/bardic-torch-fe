import { useActionData, useLoaderData } from "react-router";
import { PersonBody, type PersonView } from "~/components/person/PersonPage";
import {
  PERSON_ALIAS_KIND_LABELS,
  PERSON_KIND_LABELS,
  PERSON_ROLE_LABELS,
  PERSON_STATUS_LABELS,
} from "~/constants/vocabulary";
import type { PersonDocument } from "~/editing/documents";
import type {
  EditorActionData,
  EditorLoaderData,
  Options,
  Picker,
} from "~/editing/editor-data";
import { EditorPage } from "./EditorPage";
import {
  CheckboxField,
  ChoicesField,
  FormSection,
  labelOptions,
  MARKDOWN_HELP,
  Rows,
  SelectField,
  TextField,
} from "./fields";
import { LinkEditor } from "./LinkEditor";
import { LicensingFields } from "./LicensingFields";

/** The lists the person form picks from, and its preview names from. */
export const PERSON_PICKERS: readonly Picker[] = [
  "persons",
  "pieces",
  "events",
  "affiliations",
  "collections",
];

/** A person's fields, in sections in the order their page shows them. */
function PersonForm({
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
        <SelectField
          name="status"
          label="Status"
          value={document.status}
          options={labelOptions(PERSON_STATUS_LABELS)}
        />
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
        <Rows
          legend="Affiliations"
          path="affiliation_slugs"
          rows={document.affiliation_slugs}
          rowLabel={index => `Affiliation ${index + 1}`}
          addLabel="Add an affiliation"
        >
          {(slug, name) => (
            <SelectField
              name={name}
              label="Kingdom or group"
              value={slug === "" ? null : slug}
              options={options.affiliations ?? []}
            />
          )}
        </Rows>
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
      <FormSection title="Links">
        <LinkEditor links={document.links} options={options} ofPerson />
      </FormSection>
    </>
  );
}

/**
 * The person editor's page, from its route's loader and action
 * (editing.server.ts): a new page's `heading`, or none under the entity's head.
 */
export function PersonEditor({ heading }: { readonly heading?: string }) {
  const loaded = useLoaderData<EditorLoaderData<PersonDocument>>();
  const outcome = useActionData<EditorActionData<PersonDocument, PersonView>>();
  return (
    <EditorPage
      heading={heading}
      loaded={loaded}
      action={outcome}
      preview={outcome?.preview ? <PersonBody view={outcome.preview} /> : null}
    >
      {document => <PersonForm document={document} options={loaded.options} />}
    </EditorPage>
  );
}
