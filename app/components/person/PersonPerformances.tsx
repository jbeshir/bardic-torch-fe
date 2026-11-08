import { linkExposure, LINK_NOT_SHOWN } from "~/catalogue/restricted";
import { isUserUrl } from "~/catalogue/user-url";
import { ConservationBadge } from "~/components/ui/ConservationBadge";
import { linkName } from "~/components/links/LinkRow";
import { Link } from "~/components/ui/Link";
import type { Person } from "~/schemas/catalogue";
import { MoreNotListed } from "./Works";

type Profile = NonNullable<Person["profile"]>;
type Performance = Profile["performances"][number];

/** The piece performed: a link to its page, or "No particular piece". */
function PerformedPiece({ piece }: { readonly piece: Performance["piece"] }) {
  if (!piece)
    return <span className="text-fg-subtle">No particular piece</span>;
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Link to={`/pieces/${piece.slug}`}>{piece.title}</Link>
      {piece.conservation_status === "restricted" ? (
        <ConservationBadge status="restricted" size="sm" />
      ) : null}
    </span>
  );
}

/**
 * The recording. A restricted piece's recording is never linked off its
 * own page (plan §4.0): it says where to look instead, with no anchor and
 * no address.
 */
function Recording({ performance }: { readonly performance: Performance }) {
  if (linkExposure(performance.piece) === "internal-only") {
    return (
      <span className="text-caption text-fg-subtle">{LINK_NOT_SHOWN}</span>
    );
  }
  const { link } = performance;
  return isUserUrl(link.url) ? (
    <Link to={link.url} userContent appearance="plain">
      {linkName(link)}
    </Link>
  ) : (
    linkName(link)
  );
}

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
              <Recording performance={performance} />
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
