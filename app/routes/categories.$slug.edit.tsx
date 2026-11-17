import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { TermEditor } from "~/components/editing/TermForm";
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
  return <TermEditor />;
}
