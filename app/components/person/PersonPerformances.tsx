import { MoreNotListed } from "~/components/catalogue/MoreNotListed";
import { PerformedPiece } from "~/components/performances/PerformedPiece";
import { RecordingCell } from "~/components/performances/RecordingCell";
import { Link } from "~/components/ui/Link";
import type { Person } from "~/schemas/catalogue";

type Profile = NonNullable<Person["profile"]>;

/**
 * The performances a person is in or that their links record (plan §4.6),
 * newest year first as the API lists them: the year, the piece, the event,
 * the recording (a reader's URL; there is no liveness here, spec issue B5)
 * and the description as recorded. At most 200 are listed, so a longer
 * list ends with "and N more not listed here".
 */
export function PersonPerformances({ profile }: { readonly profile: Profile }) {
  return (
    <>
      <ul role="list" className="not-prose">
        {profile.performances.map(performance => (
          <li
            key={`${performance.link.url}:${performance.piece?.slug ?? ""}:${performance.description_verbatim}`}
            className="grid gap-1 border-b border-border py-3 text-body-sm wrap-anywhere last:border-b-0"
          >
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-semibold text-fg">
                {performance.year ?? "Year unknown"}
              </span>
              <PerformedPiece piece={performance.piece} />
            </span>
            {performance.event ? (
              <span className="text-fg-muted">
                At{" "}
                <Link
                  to={`/events/${performance.event.slug}`}
                  appearance="plain"
                >
                  {performance.event.name}
                </Link>
              </span>
            ) : null}
            <span>
              <RecordingCell
                piece={performance.piece}
                link={performance.link}
              />
            </span>
            <span className="text-fg-muted">
              As described:{" "}
              <q className="text-fg">{performance.description_verbatim}</q>
            </span>
          </li>
        ))}
      </ul>
      <MoreNotListed
        shown={profile.performances.length}
        total={profile.performances_total}
      />
    </>
  );
}
