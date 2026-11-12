import {
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { EditorPage, MarkdownPreview } from "~/components/editing/EditorPage";
import { TermForm } from "~/components/editing/TermForm";
import { matchData } from "~/catalogue/history-meta";
import { editorMeta } from "~/editing/editor-data";
import type { Term } from "~/schemas/catalogue";
import {
  editorAction,
  editorLoader,
  previewDescription,
} from "~/server/editing.server";

/** `/categories/:slug/edit`: the Edit view, under its layout's head. */

export function loader(args: LoaderFunctionArgs) {
  return editorLoader(args, {
    type: "term",
    key: args.params.slug ?? "",
    pickers: ["terms", "affiliations"],
  });
}

export function action(args: ActionFunctionArgs) {
  return editorAction(args, { type: "term", preview: previewDescription });
}

export const meta: MetaFunction = args => {
  const layout = matchData(args, "routes/categories.$slug") as
    { readonly term: Term } | undefined;
  return editorMeta(`Edit ${layout?.term.display_name ?? "the category"}`);
};

export default function CategoryEditRoute() {
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
        <TermForm document={document} options={loaded.options} isNew={false} />
      )}
    </EditorPage>
  );
}
