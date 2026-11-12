import {
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { EditorPage, MarkdownPreview } from "~/components/editing/EditorPage";
import { CollectionForm } from "~/components/editing/CollectionForm";
import { editorMeta } from "~/editing/editor-data";
import {
  editorAction,
  editorLoader,
  previewDescription,
} from "~/server/editing.server";

/** `/collections/new`: a new collection. */

export function loader(args: LoaderFunctionArgs) {
  return editorLoader(args, {
    type: "collection",
    pickers: ["affiliations", "collections"],
  });
}

export function action(args: ActionFunctionArgs) {
  return editorAction(args, {
    type: "collection",
    preview: previewDescription,
  });
}

export const meta = () => editorMeta("New collection");

export default function NewCollectionRoute() {
  const loaded = useLoaderData<typeof loader>();
  const outcome = useActionData<typeof action>();
  return (
    <EditorPage
      heading="New collection"
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
