import { useActionData, useLoaderData } from "react-router";
import type { EventDocument } from "~/editing/documents";
import type { EditorActionData, EditorLoaderData } from "~/editing/editor-data";
import { EditorPage } from "./EditorPage";
import { TextField } from "./fields";

/**
 * The event editor's page, from its route's loader and action
 * (editing.server.ts): a new page's `heading`, or none under the entity's
 * head. An event is its name, so the name is its preview.
 */
export function EventEditor({ heading }: { readonly heading?: string }) {
  const loaded = useLoaderData<EditorLoaderData<EventDocument>>();
  const outcome =
    useActionData<EditorActionData<EventDocument, { readonly name: string }>>();
  return (
    <EditorPage
      heading={heading}
      loaded={loaded}
      action={outcome}
      preview={
        outcome?.preview ? (
          <p className="text-h2 text-fg">{outcome.preview.name}</p>
        ) : null
      }
    >
      {document => <TextField name="name" label="Name" value={document.name} />}
    </EditorPage>
  );
}
