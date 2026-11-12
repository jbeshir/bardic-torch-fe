import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { TermEditor } from "~/components/editing/TermForm";
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
  return <TermEditor heading="New category" />;
}
