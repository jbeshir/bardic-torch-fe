import { ConservationBadge } from "~/components/ui/ConservationBadge";
import { Link } from "~/components/ui/Link";
import { PIECE_KIND_LABELS } from "~/constants/vocabulary";
import type { PieceSummary } from "~/schemas/catalogue";

/**
 * One piece in a list of results (plan §4.2), a row of a `ul role="list"`
 * rather than a Card, so 50 rows stay readable: the title, a standalone
 * link to the piece's page, then its kind ("Dance music"), its
 * conservation status (left out while unassessed: "Not yet assessed" on
 * every row would be noise; the piece page says it) and "Stub" when its
 * page is one. A restricted piece shows its Restricted badge and nothing
 * else: its links are only on its own page.
 */
export function PieceListItem({ piece }: { readonly piece: PieceSummary }) {
  return (
    <li className="border-b border-border py-3 last:border-b-0">
      <div className="text-body-lg">
        <Link to={`/pieces/${piece.slug}`} compact>
          {piece.title}
        </Link>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-fg-muted">
        <span>{PIECE_KIND_LABELS[piece.kind]}</span>
        {piece.conservation_status === "unassessed" ? null : (
          <ConservationBadge status={piece.conservation_status} size="sm" />
        )}
        {piece.is_stub ? (
          <span className="text-caption text-fg-subtle">Stub</span>
        ) : null}
      </div>
    </li>
  );
}
