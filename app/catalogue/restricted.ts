import type { ConservationStatus } from "~/schemas/catalogue";

/**
 * How far a piece's link may be shown (plan §4.0), the one policy for
 * every place an API URL is rendered beside a piece: `full` (an anchor) for
 * any piece but a restricted one; `internal-only` for a restricted piece,
 * whose creator asked that it isn't recorded or shared. Off the piece's own
 * page, an internal-only link is only named, with the caption "Link not
 * shown: see the piece page"; on its own page, its links are kept inside
 * one closed disclosure, without archive copies.
 */
export function linkExposure(piece: {
  readonly conservation_status: ConservationStatus;
}): "full" | "internal-only" {
  return piece.conservation_status === "restricted" ? "internal-only" : "full";
}
