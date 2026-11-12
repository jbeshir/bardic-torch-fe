import { Fragment } from "react";
import { RowTable } from "~/components/catalogue/RowTable";
import { PerformedPiece } from "~/components/performances/PerformedPiece";
import { RecordingCell } from "~/components/performances/RecordingCell";
import { PersonName } from "~/components/person/PersonName";
import { MoreNotListed } from "~/components/catalogue/MoreNotListed";
import type { EventPerformance } from "~/schemas/catalogue";

function Performers({
  performance,
}: {
  readonly performance: EventPerformance;
}) {
  if (performance.performers.length === 0) {
    return <span className="text-fg-subtle">—</span>;
  }
  return performance.performers.map((performer, index) => (
    <Fragment key={performer.slug ?? performer.name}>
      {index > 0 ? ", " : null}
      <PersonName person={performer} appearance="prose" />
    </Fragment>
  ));
}

/**
 * The performances recorded at an event or venue (plan §4.10), in the
 * API's order (newest year first, unknown years last): the year, the piece
 * (or "No particular piece"), the performers and the recording, a table
 * from md and cards below. A restricted piece is named and linked to its
 * page, with "Link not shown" for its recording (§4.0). The API caps the
 * list at 200: "and {n} more not listed here" says how many aren't listed.
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
            header: "Piece",
            cell: performance => <PerformedPiece piece={performance.piece} />,
          },
          {
            header: "Year",
            nowrap: true,
            cell: performance =>
              performance.year === null ? (
                <span className="text-fg-subtle">Unknown</span>
              ) : (
                String(performance.year)
              ),
          },
          {
            header: "Performers",
            cell: performance => <Performers performance={performance} />,
          },
          {
            header: "Recording",
            cell: performance => (
              <RecordingCell
                piece={performance.piece}
                link={performance.link}
              />
            ),
          },
        ]}
      />
      <MoreNotListed shown={performances.length} total={total} />
    </>
  );
}
