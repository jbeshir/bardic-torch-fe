import { RowTable } from "~/components/catalogue/RowTable";
import { UserLink } from "~/components/catalogue/UserLink";
import { ConservationBadge } from "~/components/ui/ConservationBadge";
import { Link } from "~/components/ui/Link";
import { formatNumber } from "~/catalogue/format";
import { linkExposure, LINK_NOT_SHOWN } from "~/catalogue/restricted";
import {
  LINK_ROLE_LABELS,
  PERSON_KIND_LABELS,
  PIECE_KIND_LABELS,
} from "~/constants/vocabulary";
import type { CollectionCitation } from "~/schemas/catalogue";

/** What a citation cites: the piece or the bard, linked, with its kind. */
function Cited({ citation }: { readonly citation: CollectionCitation }) {
  const { piece, person } = citation;
  if (piece) {
    return (
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <Link to={`/pieces/${piece.slug}`} appearance="prose">
          {piece.title}
        </Link>
        <span className="text-caption text-fg-muted">
          {PIECE_KIND_LABELS[piece.kind]}
        </span>
        {piece.conservation_status === "restricted" ? (
          <ConservationBadge status="restricted" size="sm" />
        ) : null}
      </span>
    );
  }
  if (person) {
    return (
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <Link to={`/bards/${person.slug}`} appearance="prose">
          {person.name}
        </Link>
        <span className="text-caption text-fg-muted">
          {PERSON_KIND_LABELS[person.kind]}
        </span>
      </span>
    );
  }
  // The API sets exactly one of the two; nothing to name otherwise.
  return <span className="text-fg-subtle">—</span>;
}

/** The citation's link, or, for a restricted piece, why it isn't shown. */
function CitedLink({ citation }: { readonly citation: CollectionCitation }) {
  if (linkExposure(citation.piece) === "internal-only") {
    return <span className="text-fg-subtle">{LINK_NOT_SHOWN}</span>;
  }
  return (
    <UserLink url={citation.url}>{citation.title ?? citation.url}</UserLink>
  );
}

/**
 * What a collection cites (plan §4.9): each piece or bard with the link it
 * is cited by, its place in the collection and the link's roles, a table
 * from md and cards below. A restricted piece is named and linked to its
 * own page, with "Link not shown" for its link (§4.0). The API caps the
 * list at 200: "and {n} more" says how many aren't listed.
 */
export function Citations({
  citations,
  total,
}: {
  readonly citations: readonly CollectionCitation[];
  /** How many there are in all (`citations_total`). */
  readonly total: number;
}) {
  if (citations.length === 0) {
    return (
      <p className="text-body-sm text-fg-subtle">
        Nothing cited from this collection yet.
      </p>
    );
  }
  return (
    <>
      <RowTable
        label="Citations"
        rows={citations}
        rowKey={citation =>
          `${citation.piece?.slug ?? citation.person?.slug ?? ""} ${citation.url}`
        }
        columns={[
          {
            header: "Piece or bard",
            cell: citation => <Cited citation={citation} />,
          },
          {
            header: "Link",
            cell: citation => <CitedLink citation={citation} />,
          },
          {
            header: "Where",
            cell: citation => citation.locator ?? "—",
          },
          {
            header: "Roles",
            cell: citation =>
              citation.roles.map(role => LINK_ROLE_LABELS[role]).join(", ") ||
              "—",
          },
        ]}
      />
      {total > citations.length ? (
        <p className="mt-3 text-body-sm text-fg-muted">
          {`and ${formatNumber(total - citations.length)} more`}
        </p>
      ) : null}
    </>
  );
}
