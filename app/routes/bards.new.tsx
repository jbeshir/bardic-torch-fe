import {
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { EditorPage } from "~/components/editing/EditorPage";
import { PersonForm, PERSON_PICKERS } from "~/components/editing/PersonForm";
import { PersonBody } from "~/components/person/PersonPage";
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
  const loaded = useLoaderData<typeof loader>();
  const outcome = useActionData<typeof action>();
  return (
    <EditorPage
      heading="New bard or group"
      loaded={loaded}
      action={outcome}
      preview={outcome?.preview ? <PersonBody view={outcome.preview} /> : null}
    >
      {document => <PersonForm document={document} options={loaded.options} />}
    </EditorPage>
  );
}
