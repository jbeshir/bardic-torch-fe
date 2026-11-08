import { useOutletContext } from "react-router";
import { PiecePage, type PieceView } from "~/components/piece/PiecePage";

/**
 * `/pieces/:slug`'s Read view (plan §4.5): the piece its layout loaded.
 */
export default function PieceRead() {
  return <PiecePage view={useOutletContext<PieceView>()} />;
}
