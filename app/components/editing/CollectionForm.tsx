import { useActionData, useLoaderData } from "react-router";
import type { MarkdownTree } from "~/schemas/markdown";
import { COLLECTION_KIND_LABELS } from "~/constants/vocabulary";
import type { CollectionDocument } from "~/editing/documents";
import type {
  EditorActionData,
  EditorLoaderData,
  Options,
} from "~/editing/editor-data";
import { EditorPage, MarkdownPreview } from "./EditorPage";
import { labelOptions, SelectField, TextField, MARKDOWN_HELP } from "./fields";

/** A collection's fields: its region is an affiliation. */
function CollectionForm({
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
        name="region_term_slug"
        label="Region"
        value={document.region_term_slug}
        options={options.affiliations ?? []}
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

/**
 * The collection editor's page, from its route's loader and action
 * (editing.server.ts): a new page's `heading`, or none under the entity's head.
 */
export function CollectionEditor({ heading }: { readonly heading?: string }) {
  const loaded = useLoaderData<EditorLoaderData<CollectionDocument>>();
  const outcome =
    useActionData<
      EditorActionData<
        CollectionDocument,
        { readonly description: MarkdownTree | null }
      >
    >();
  return (
    <EditorPage
      heading={heading}
      loaded={loaded}
      action={outcome}
      preview={
        outcome?.preview ? (
          <MarkdownPreview tree={outcome.preview.description} />
        ) : null
      }
    >
      {document => (
        <CollectionForm document={document} options={loaded.options} />
      )}
    </EditorPage>
  );
}
