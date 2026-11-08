import { Fragment } from "react";
import { RowTable } from "~/components/catalogue/RowTable";
import { UserLink } from "~/components/catalogue/UserLink";
import { ConservationBadge } from "~/components/ui/ConservationBadge";
import { Link } from "~/components/ui/Link";
import { formatNumber } from "~/catalogue/format";
import { linkExposure, LINK_NOT_SHOWN } from "~/catalogue/restricted";
import type { EventPerformance } from "~/schemas/catalogue";

function Piece({ performance }: { readonly performance: EventPerformance }) {
  const { piece } = performance;
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

function Performers({
  performance,
}: {
  readonly performance: EventPerformance;
}) {
  if (performance.performers.length === 0) {
    return <span className="text-fg-subtle">—</span>;
  }
  return performance.performers.map((performer, index) => (
    <Fragment key={performer.slug}>
      {index > 0 ? ", " : null}
      <Link to={`/bards/${performer.slug}`} appearance="prose">
        {performer.name}
      </Link>
    </Fragment>
  ));
}

function Recording({
  performance,
}: {
  readonly performance: EventPerformance;
}) {
  if (linkExposure(performance.piece) === "internal-only") {
    return <span className="text-fg-subtle">{LINK_NOT_SHOWN}</span>;
  }
  const { link } = performance;
  return (
    <UserLink url={link.url}>
      {link.title ?? link.url}
      {link.platform ? (
        <span className="text-fg-muted"> ({link.platform})</span>
      ) : null}
    </UserLink>
  );
}

/**
 * The performances recorded at an event or venue (plan §4.10), in the
 * API's order (newest year first, unknown years last): the year, the piece
 * (or "No particular piece"), the performers and the recording, a table
 * from md and cards below. A restricted piece is named and linked to its
 * page, with "Link not shown" for its recording (§4.0). The API caps the
 * list at 200: "and {n} more" says how many aren't listed.
 */
export function EventPerformances({
  performances,
  total,
}: {
  readonly performances: readonly EventPerformance[];
  /** How many there are in all (`performances_total`). */
  readonly total: number;
}) {
  if (performances.length === 0) {
    return (
      <p className="text-body-sm text-fg-subtle">
        No performances recorded here yet.
      </p>
    );
  }
  return (
    <>
      <RowTable
        label="Performances recorded here"
        rows={performances}
        rowKey={(performance, index) =>
          `${index} ${performance.piece?.slug ?? ""} ${performance.link.url}`
        }
        columns={[
          {
            header: "Year",
            cell: performance =>
              performance.year === null ? (
                <span className="text-fg-subtle">Unknown</span>
              ) : (
                String(performance.year)
              ),
          },
          {
            header: "Piece",
            cell: performance => <Piece performance={performance} />,
          },
          {
            header: "Performers",
            cell: performance => <Performers performance={performance} />,
          },
          {
            header: "Recording",
            cell: performance => <Recording performance={performance} />,
          },
        ]}
      />
      {total > performances.length ? (
        <p className="mt-3 text-body-sm text-fg-muted">
          {`and ${formatNumber(total - performances.length)} more`}
        </p>
      ) : null}
    </>
  );
}
