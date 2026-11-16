import { ConservationBadge } from "~/components/ui/ConservationBadge";
import { Link } from "~/components/ui/Link";
import type { PieceSummary } from "~/schemas/catalogue";

/**
 * The piece a performance is of, in an event's or a bard's performances: a
 * link to its page (with a badge when it is restricted), or "No
 * particular piece".
 */
export function PerformedPiece({
  piece,
}: {
  readonly piece: PieceSummary | null;
}) {
  if (!piece) {
    return <span className="text-fg-muted">No particular piece</span>;
  }
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Link to={`/pieces/${piece.slug}`} appearance="prose">
        {piece.title}
      </Link>
      {piece.conservation_status === "restricted" ? (
        <ConservationBadge status="restricted" size="sm" />
      ) : null}
    </span>
  );
}
