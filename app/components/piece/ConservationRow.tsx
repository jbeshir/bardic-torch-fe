import { formatDate, formatNumber } from "~/catalogue/format";
import { isUserUrl } from "~/catalogue/user-url";
import { Disclosure } from "~/components/catalogue/Disclosure";
import { ConservationBadge } from "~/components/ui/ConservationBadge";
import { Link } from "~/components/ui/Link";
import type { Piece } from "~/schemas/catalogue";

/**
 * A piece's conservation status in its infobox (plan §4.5): the badge as a
 * link to the status's entry on the help page, then, when the status has a
 * history, "Status history ({n})" closed under it, oldest first: the date,
 * the status, why, and the source the reviewer gave. The source is a
 * reader's URL (nofollow ugc). A restricted piece's sources are statements
 * about the restriction, not the work, so they are shown too (plan §4.0).
 */
export function ConservationRow({
  piece,
}: {
  readonly piece: Pick<Piece, "conservation_status" | "conservation_history">;
}) {
  const history = piece.conservation_history;
  return (
    <div className="grid justify-items-start gap-2">
      <ConservationBadge status={piece.conservation_status} size="sm" link />
      {history.length > 0 ? (
        <Disclosure
          summary={`Status history (${formatNumber(history.length)})`}
        >
          <ol role="list" className="grid gap-3">
            {history.map(change => (
              <li
                key={`${change.at}:${change.conservation_status}`}
                className="grid justify-items-start gap-1"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <time
                    dateTime={change.at}
                    className="text-caption text-fg-subtle"
                  >
                    {formatDate(change.at)}
                  </time>
                  <ConservationBadge
                    status={change.conservation_status}
                    size="sm"
                  />
                </span>
                <span>{change.reason}</span>
                {change.source_url && isUserUrl(change.source_url) ? (
                  <Link to={change.source_url} userContent compact>
                    Source
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
        </Disclosure>
      ) : null}
    </div>
  );
}
