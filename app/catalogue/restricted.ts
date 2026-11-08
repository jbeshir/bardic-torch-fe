import type { PieceSummary } from "~/schemas/catalogue";

/**
 * How far a piece's link may be shown (plan §4.0), the one policy for
 * every place an API URL is rendered beside a piece: `full` (an anchor) for
 * any piece but a restricted one, and for a link beside no piece;
 * `internal-only` for a restricted piece, whose creator asked that it isn't
 * recorded or shared. Off the piece's own page, an internal-only link is
 * only named, with the caption {@link LINK_NOT_SHOWN}; on its own page, its
 * links are kept inside one closed disclosure, without archive copies.
 */
type LinkExposure = "full" | "internal-only";

export function linkExposure(
  piece: Pick<PieceSummary, "conservation_status"> | null
): LinkExposure {
  return piece?.conservation_status === "restricted" ? "internal-only" : "full";
}

/** The caption shown in place of a restricted piece's link. */
export const LINK_NOT_SHOWN = "Link not shown: see the piece page";

/**
 * `row` with its link's address and title emptied when its piece is
 * restricted, so a loader never sends them to the page at all (not even
 * in the data it hydrates from): the row still names the piece.
 */
export function withoutRestrictedLink<
  Row extends {
    readonly piece: Pick<PieceSummary, "conservation_status"> | null;
    readonly url: string;
    readonly title: string | null;
  },
>(row: Row): Row {
  return linkExposure(row.piece) === "internal-only"
    ? { ...row, url: "", title: null }
    : row;
}
