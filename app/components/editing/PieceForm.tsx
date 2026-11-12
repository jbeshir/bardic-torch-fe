import { useActionData, useLoaderData } from "react-router";
import { PieceBody, type PieceView } from "~/components/piece/PiecePage";
import {
  CONSERVATION_LABELS,
  LICENCE_LABELS,
  PIECE_ALIAS_KIND_LABELS,
  PIECE_KIND_LABELS,
  PIECE_RELATION_LABELS,
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
  ChoicesField,
  FormSection,
  labelOptions,
  MARKDOWN_HELP,
  relationOptions,
  Rows,
  SelectField,
  TextField,
} from "./fields";
import { LinkEditor } from "./LinkEditor";
import { LicensingFields, SourcedField } from "./SourcedField";
import { TermPicker } from "./TermPicker";

const VERSIONS = ["4.0", "3.0", "2.5", "2.0", "1.0"].map(version => ({
  value: version,
  label: version,
}));

/** The lists the piece form picks from, and its preview names from. */
export const PIECE_PICKERS: readonly Picker[] = [
  "persons",
  "pieces",
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
        <ChoicesField
          name="secondary_kinds"
          legend="Other kinds"
          values={document.secondary_kinds}
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
        <TextField
          name="period_start"
          label="Period from (year)"
          type="number"
          value={document.period_start}
          optional
        />
        <TextField
          name="period_end"
          label="Period to (year)"
          type="number"
          value={document.period_end}
          optional
        />
        <CreditEditor
          credits={document.credits}
          persons={options.persons ?? []}
        />
        <SourcedField
          legend="Conservation status"
          name="conservation.status"
          value={document.conservation.status}
          options={labelOptions(CONSERVATION_LABELS)}
          exempt={CONSERVATION_LABELS.unassessed}
          sourceName="conservation.source_url"
          sourceValue={document.conservation.source_url}
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
        >
          <SelectField
            name="licence"
            label="Licence"
            value={document.licence}
            options={labelOptions(LICENCE_LABELS)}
            optional
          />
          <SelectField
            name="licence_version"
            label="Licence version"
            value={document.licence_version}
            options={VERSIONS}
            optional
          />
        </LicensingFields>
      </FormSection>
      <FormSection title="Versions and sources">
        <TextField
          name="version_notes_md"
          label="Versions"
          help={MARKDOWN_HELP}
          value={document.version_notes_md}
          multiline
          optional
        />
        <TextField
          name="historical_source_md"
          label="Historical source"
          help={MARKDOWN_HELP}
          value={document.historical_source_md}
          multiline
          optional
        />
      </FormSection>
      <FormSection title="Related pieces and categories">
        <Rows
          legend="Related pieces"
          path="relations"
          rows={document.relations}
          rowLabel={index => `Related piece ${index + 1}`}
          addLabel="Add a related piece"
        >
          {(relation, name) => (
            <>
              <SelectField
                name={`${name}.type`}
                label="Relation"
                value={relation.type}
                options={relationOptions(PIECE_RELATION_LABELS)}
              />
              <SelectField
                name={`${name}.to_piece_slug`}
                label="Piece"
                value={
                  relation.to_piece_slug === "" ? null : relation.to_piece_slug
                }
                options={options.pieces ?? []}
              />
            </>
          )}
        </Rows>
        <TermPicker terms={document.terms} options={options.terms ?? []} />
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
