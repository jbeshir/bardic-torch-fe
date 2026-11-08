import { Fragment } from "react";
import { isUserUrl } from "~/catalogue/user-url";
import { linkName } from "~/components/links/LinkRow";
import { Link } from "~/components/ui/Link";
import type { Piece } from "~/schemas/catalogue";

type PieceLink = Piece["links"][number];
type Performance = PieceLink["performances"][number] & {
  /** The recording: the link the performance is recorded on. */
  readonly link: PieceLink;
  /** The link's address and the performance's place in its list. */
  readonly id: string;
};

/**
 * Every performance the piece's links record, newest year first and
 * unknown years last; performances of a year keep the links' order.
 */
export function performancesOf(links: readonly PieceLink[]): Performance[] {
  return links
    .flatMap(link =>
      link.performances.map((each, place) => ({
        ...each,
        link,
        id: `${link.url}#${place}`,
      }))
    )
    .sort((a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity));
}

/** "Wren", "Wren and Aldith", "Wren, Aldith and the Northmarch Bards". */
function Performers({
  performers,
}: {
  readonly performers: Performance["performers"];
}) {
  if (performers.length === 0) return <span className="text-fg-subtle">—</span>;
  return performers.map((person, index) => (
    <Fragment key={person.slug}>
      {index === 0 ? "" : index === performers.length - 1 ? " and " : ", "}
      <Link to={`/bards/${person.slug}`} appearance="plain">
        {person.name}
      </Link>
    </Fragment>
  ));
}

function Recording({ link }: { readonly link: PieceLink }) {
  return isUserUrl(link.url) ? (
    <Link to={link.url} userContent appearance="plain">
      {linkName(link)}
    </Link>
  ) : (
    linkName(link)
  );
}

function Event({ event }: { readonly event: Performance["event"] }) {
  return event ? (
    <Link to={`/events/${event.slug}`} appearance="plain">
      {event.name}
    </Link>
  ) : (
    <span className="text-fg-subtle">—</span>
  );
}

/** The description, word for word as the uploader wrote it. */
function AsDescribed({ text }: { readonly text: string }) {
  return (
    <span className="text-fg-muted">
      As described: <q className="text-fg">{text}</q>
    </span>
  );
}

const yearOf = (performance: Performance) =>
  performance.year === null ? "Year unknown" : String(performance.year);

/**
 * A piece's recorded performances (plan §4.5): a table from md, a card per
 * performance below it. Each has its year, its performers (links to their
 * pages), its event, the recording (a reader's URL), who uploaded it and
 * the description as they wrote it, in quotes. Nothing when there are none.
 */
export function Performances({
  links,
}: {
  readonly links: readonly PieceLink[];
}) {
  const performances = performancesOf(links);
  if (performances.length === 0) return null;
  return (
    <>
      <table className="hidden md:table">
        <thead>
          <tr>
            <th scope="col">Year</th>
            <th scope="col">Performers</th>
            <th scope="col">Event</th>
            <th scope="col">Recording</th>
            <th scope="col">Uploaded by</th>
          </tr>
        </thead>
        <tbody>
          {performances.map(performance => (
            <tr key={performance.id}>
              <td className="whitespace-nowrap">{yearOf(performance)}</td>
              <td>
                <Performers performers={performance.performers} />
              </td>
              <td>
                <Event event={performance.event} />
              </td>
              <td className="wrap-anywhere">
                <Recording link={performance.link} />
                <span className="mt-1 block">
                  <AsDescribed text={performance.description_verbatim} />
                </span>
              </td>
              <td>
                {performance.uploader ?? (
                  <span className="text-fg-subtle">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul role="list" className="not-prose grid gap-3 md:hidden">
        {performances.map(performance => (
          <li
            key={performance.id}
            className="grid gap-1 rounded-lg border border-border p-3 text-body-sm wrap-anywhere"
          >
            <span className="font-semibold text-fg">{yearOf(performance)}</span>
            <span>
              <Recording link={performance.link} />
            </span>
            <AsDescribed text={performance.description_verbatim} />
            {performance.performers.length > 0 ? (
              <span className="text-fg-muted">
                By <Performers performers={performance.performers} />
              </span>
            ) : null}
            {performance.event ? (
              <span className="text-fg-muted">
                At <Event event={performance.event} />
              </span>
            ) : null}
            {performance.uploader ? (
              <span className="text-caption text-fg-subtle">
                Uploaded by {performance.uploader}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
