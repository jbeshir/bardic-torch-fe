import { PIECE_KIND_LABELS } from "~/constants/vocabulary";
import type { Piece } from "~/schemas/catalogue";

/**
 * When a piece dates from, as its infobox and meta line say it: "1580–1600",
 * "1588" (one year), "from 1580", "until 1600"; null when neither end is
 * known, so the row is left out.
 */
export function formatPeriod(
  start: number | null,
  end: number | null
): string | null {
  if (start !== null && end !== null) {
    return start === end ? `${start}` : `${start}–${end}`;
  }
  if (start !== null) return `from ${start}`;
  if (end !== null) return `until ${end}`;
  return null;
}

/**
 * A piece's meta line under its title (DESIGN §5.4 item 3): its kind, its
 * secondary kinds and its period, "Song · Dance music · 1580–1600".
 */
export function pieceSubtitle(
  piece: Pick<Piece, "kind" | "secondary_kinds" | "period_start" | "period_end">
): string {
  const period = formatPeriod(piece.period_start, piece.period_end);
  return [
    PIECE_KIND_LABELS[piece.kind],
    ...piece.secondary_kinds.map(kind => PIECE_KIND_LABELS[kind]),
    ...(period ? [period] : []),
  ].join(" · ");
}

/**
 * Where the creator of a restricted piece said so: the source of the newest
 * `restricted` entry in its status history, if it has one.
 */
export function restrictionStatement(
  history: Piece["conservation_history"]
): string | null {
  const newest = [...history]
    .reverse()
    .find(change => change.conservation_status === "restricted");
  return newest?.source_url ?? null;
}
