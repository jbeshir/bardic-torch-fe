import {
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { EditorPage, MarkdownPreview } from "~/components/editing/EditorPage";
import { EventForm } from "~/components/editing/EventForm";
import { editorMeta } from "~/editing/editor-data";
import {
  editorAction,
  editorLoader,
  previewDescription,
} from "~/server/editing.server";

/** `/events/new`: a new event or venue. */

export function loader(args: LoaderFunctionArgs) {
  return editorLoader(args, { type: "event" });
}

export function action(args: ActionFunctionArgs) {
  return editorAction(args, { type: "event", preview: previewDescription });
}

export const meta = () => editorMeta("New event or venue");

export default function NewEventRoute() {
  const loaded = useLoaderData<typeof loader>();
  const outcome = useActionData<typeof action>();
  return (
    <EditorPage
      heading="New event or venue"
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
