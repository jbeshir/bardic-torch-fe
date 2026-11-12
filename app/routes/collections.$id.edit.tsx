import {
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { EditorPage, MarkdownPreview } from "~/components/editing/EditorPage";
import { CollectionForm } from "~/components/editing/CollectionForm";
import { matchData } from "~/catalogue/history-meta";
import { editorMeta } from "~/editing/editor-data";
import type { Collection } from "~/schemas/catalogue";
import {
  editorAction,
  editorLoader,
  previewDescription,
} from "~/server/editing.server";

/** `/collections/:id/edit`: the Edit view, under its layout's head. */

export function loader(args: LoaderFunctionArgs) {
  return editorLoader(args, {
    type: "collection",
    key: args.params.id ?? "",
    pickers: ["affiliations", "collections"],
  });
}

export function action(args: ActionFunctionArgs) {
  return editorAction(args, {
    type: "collection",
    preview: previewDescription,
  });
}

export const meta: MetaFunction = args => {
  const layout = matchData(args, "routes/collections.$id") as
    { readonly collection: Collection } | undefined;
  return editorMeta(`Edit ${layout?.collection.name ?? "the collection"}`);
};

export default function CollectionEditRoute() {
  const loaded = useLoaderData<typeof loader>();
  const outcome = useActionData<typeof action>();
  return (
    <EditorPage
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
