import {
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { EditorPage, MarkdownPreview } from "~/components/editing/EditorPage";
import { TermForm } from "~/components/editing/TermForm";
import { editorMeta } from "~/editing/editor-data";
import {
  editorAction,
  editorLoader,
  previewDescription,
} from "~/server/editing.server";

/** `/categories/new`: a new category (term), which needs a parent. */

export function loader(args: LoaderFunctionArgs) {
  return editorLoader(args, {
    type: "term",
    pickers: ["terms", "affiliations"],
  });
}

export function action(args: ActionFunctionArgs) {
  return editorAction(args, { type: "term", preview: previewDescription });
}

export const meta = () => editorMeta("New category");

export default function NewCategoryRoute() {
  const loaded = useLoaderData<typeof loader>();
  const outcome = useActionData<typeof action>();
  return (
    <EditorPage
      heading="New category"
      loaded={loaded}
      action={outcome}
      preview={
        outcome?.preview ? (
          <MarkdownPreview tree={outcome.preview.description} />
        ) : null
      }
    >
      {document => (
        <TermForm document={document} options={loaded.options} isNew />
      )}
    </EditorPage>
  );
}
