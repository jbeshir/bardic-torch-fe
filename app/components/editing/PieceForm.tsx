import { useActionData, useLoaderData } from "react-router";
import { PieceBody, type PieceView } from "~/components/piece/PiecePage";
import {
  CONSERVATION_LABELS,
  PIECE_ALIAS_KIND_LABELS,
  PIECE_KIND_LABELS,
} from "~/constants/vocabulary";
import type { PieceDocument } from "~/editing/documents";
import type {
  EditorActionData,
  EditorLoaderData,
  Options,
  Picker,
} from "~/editing/editor-data";
import { EditorPage } from "./EditorPage";
import { CreditEditor } from "./CreditEditor";
import {
  CheckboxField,
  FormSection,
  labelOptions,
  MARKDOWN_HELP,
  Rows,
  SelectField,
  TextField,
} from "./fields";
import { LinkEditor } from "./LinkEditor";
import { LicensingFields } from "./LicensingFields";
import { TermPicker } from "./TermPicker";

/** The lists the piece form picks from, and its preview names from. */
export const PIECE_PICKERS: readonly Picker[] = [
  "persons",
  "events",
  "terms",
  "collections",
];

/** A piece's fields, in sections in the order its page shows them. */
function PieceForm({
  document,
  options,
}: {
  readonly document: PieceDocument;
  readonly options: Options;
}) {
  return (
    <>
      <FormSection title="The piece">
        <TextField name="title" label="Title" value={document.title} />
        <SelectField
          name="kind"
          label="Kind"
          value={document.kind}
          options={labelOptions(PIECE_KIND_LABELS)}
        />
        <Rows
          legend="Other titles"
          path="aliases"
          rows={document.aliases}
          rowLabel={index => `Other title ${index + 1}`}
          addLabel="Add another title"
        >
          {(alias, name) => (
            <>
              <TextField
                name={`${name}.text`}
                label="Title"
                value={alias.text}
              />
              <SelectField
                name={`${name}.kind`}
                label="Kind"
                value={alias.kind}
                options={labelOptions(PIECE_ALIAS_KIND_LABELS)}
              />
            </>
          )}
        </Rows>
        <CreditEditor
          credits={document.credits}
          persons={options.persons ?? []}
        />
        <SelectField
          name="conservation_status"
          label="Conservation status"
          value={document.conservation_status}
          options={labelOptions(CONSERVATION_LABELS)}
        />
        <CheckboxField
          name="is_stub"
          label="A stub: the page needs more"
          checked={document.is_stub}
        />
        <TextField
          name="notes_md"
          label="Notes"
          help={MARKDOWN_HELP}
          value={document.notes_md}
          multiline
          optional
        />
      </FormSection>
      <FormSection title="Where to find it">
        <LinkEditor links={document.links} options={options} ofPerson={false} />
      </FormSection>
      <FormSection title="Licensing">
        <LicensingFields
          status={document.licensing_status}
          notes={document.licensing_notes_md}
        />
      </FormSection>
      <FormSection title="Versions and categories">
        <TextField
          name="version_notes_md"
          label="Versions"
          help={MARKDOWN_HELP}
          value={document.version_notes_md}
          multiline
          optional
        />
        <TermPicker terms={document.term_slugs} options={options.terms ?? []} />
      </FormSection>
    </>
  );
}

/**
 * The piece editor's page, from its route's loader and action
 * (editing.server.ts): a new page's `heading`, or none under the entity's head.
 */
export function PieceEditor({ heading }: { readonly heading?: string }) {
  const loaded = useLoaderData<EditorLoaderData<PieceDocument>>();
  const outcome = useActionData<EditorActionData<PieceDocument, PieceView>>();
  return (
    <EditorPage
      heading={heading}
      loaded={loaded}
      action={outcome}
      preview={outcome?.preview ? <PieceBody view={outcome.preview} /> : null}
    >
      {document => <PieceForm document={document} options={loaded.options} />}
    </EditorPage>
  );
}
