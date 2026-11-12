import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { CollectionEditor } from "~/components/editing/CollectionForm";
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
  return <CollectionEditor heading="New collection" />;
}
