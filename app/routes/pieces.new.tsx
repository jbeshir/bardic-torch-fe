import {
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { EditorPage } from "~/components/editing/EditorPage";
import { PieceForm, PIECE_PICKERS } from "~/components/editing/PieceForm";
import { PieceBody } from "~/components/piece/PiecePage";
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
  const loaded = useLoaderData<typeof loader>();
  const outcome = useActionData<typeof action>();
  return (
    <EditorPage
      heading="New piece"
      loaded={loaded}
      action={outcome}
      preview={outcome?.preview ? <PieceBody view={outcome.preview} /> : null}
    >
      {document => <PieceForm document={document} options={loaded.options} />}
    </EditorPage>
  );
}
