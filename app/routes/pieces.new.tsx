import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { PieceEditor, PIECE_PICKERS } from "~/components/editing/PieceForm";
import { editorMeta } from "~/editing/editor-data";
import { editorAction, editorLoader } from "~/server/editing.server";
import { previewPiece } from "~/server/preview.server";

/** `/pieces/new`: a new piece. */

export function loader(args: LoaderFunctionArgs) {
  return editorLoader(args, { type: "piece", pickers: PIECE_PICKERS });
}

export function action(args: ActionFunctionArgs) {
  return editorAction(args, {
    type: "piece",
    preview: previewPiece,
    pickers: PIECE_PICKERS,
  });
}

export const meta = () => editorMeta("New piece");

export default function NewPieceRoute() {
  return <PieceEditor heading="New piece" />;
}
