import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { PersonEditor, PERSON_PICKERS } from "~/components/editing/PersonForm";
import { editorMeta } from "~/editing/editor-data";
import { editorAction, editorLoader } from "~/server/editing.server";
import { previewPerson } from "~/server/preview.server";

/** `/bards/new`: a new bard or group (a person). */

export function loader(args: LoaderFunctionArgs) {
  return editorLoader(args, { type: "person", pickers: PERSON_PICKERS });
}

export function action(args: ActionFunctionArgs) {
  return editorAction(args, {
    type: "person",
    preview: previewPerson,
    pickers: PERSON_PICKERS,
  });
}

export const meta = () => editorMeta("New bard or group");

export default function NewBardRoute() {
  return <PersonEditor heading="New bard or group" />;
}
