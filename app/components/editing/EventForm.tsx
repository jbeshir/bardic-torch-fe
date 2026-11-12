import { useActionData, useLoaderData } from "react-router";
import type { MarkdownTree } from "~/schemas/markdown";
import { EVENT_KIND_LABELS } from "~/constants/vocabulary";
import type { EventDocument } from "~/editing/documents";
import type { EditorActionData, EditorLoaderData } from "~/editing/editor-data";
import { EditorPage, MarkdownPreview } from "./EditorPage";
import { labelOptions, SelectField, TextField, MARKDOWN_HELP } from "./fields";

/** An event's or venue's fields. */
function EventForm({ document }: { readonly document: EventDocument }) {
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

/**
 * The event editor's page, from its route's loader and action
 * (editing.server.ts): a new page's `heading`, or none under the entity's head.
 */
export function EventEditor({ heading }: { readonly heading?: string }) {
  const loaded = useLoaderData<EditorLoaderData<EventDocument>>();
  const outcome =
    useActionData<
      EditorActionData<
        EventDocument,
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
      {document => <EventForm document={document} />}
    </EditorPage>
  );
}
