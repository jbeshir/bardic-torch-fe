import type { PieceSummary } from "~/schemas/catalogue";

/**
 * How far a link beside a piece may be shown (plan §4.0): in full, or,
 * for a restricted piece (its creator asked that it isn't spread), only
 * through the piece's own page, never as an anchor or a URL. Every row that
 * renders an API URL beside a piece asks this.
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
