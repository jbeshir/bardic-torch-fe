import {
  useOutletContext,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { PieceEditor, PIECE_PICKERS } from "~/components/editing/PieceForm";
import { EntityPage } from "~/components/EntityPage";
import { pieceHead, type PieceView } from "~/components/piece/PiecePage";
import { matchData } from "~/catalogue/history-meta";
import { editorMeta } from "~/editing/editor-data";
import { editorAction, editorLoader } from "~/server/editing.server";
import { previewPiece } from "~/server/preview.server";

/** `/pieces/:slug/edit`: the Edit view, under its head (`pieceHead`). */

export function loader(args: LoaderFunctionArgs) {
  return editorLoader(args, {
    type: "piece",
    key: args.params.slug ?? "",
    pickers: PIECE_PICKERS,
  });
}

export function action(args: ActionFunctionArgs) {
  return editorAction(args, {
    type: "piece",
    preview: previewPiece,
    pickers: PIECE_PICKERS,
  });
}

export const meta: MetaFunction = args => {
  const layout = matchData(args, "routes/pieces.$slug") as
    PieceView | undefined;
  return editorMeta(`Edit ${layout?.piece.title ?? "the piece"}`);
};

export default function PieceEditRoute() {
  const { piece } = useOutletContext<PieceView>();
  return (
    <EntityPage {...pieceHead(piece)}>
      <PieceEditor />
    </EntityPage>
  );
}
