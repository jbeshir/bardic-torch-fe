import { DRILL_BOOK_ID } from "./collections";
import { MUSTER_FIELD_SLUG } from "./events";
import type { RawLink } from "./links";
import type { RawPiece } from "./pieces";

/**
 * The deterministic filler for the capped lists (PLAN §7.3): 205 practice
 * pieces by one invented bard, all cited by one collection, with a
 * performance each at one event (all but the last three). It uses no
 * randomness and no clock, so two runs give identical records.
 */

const DRILL_COUNT = 205;
/** The practice pieces with a performance at Muster Field. */
const DRILL_PERFORMANCE_COUNT = 202;
const DRILL_BARD_SLUG = "brannoc-the-drillmaster";

function pad(n: number): string {
  return String(n).padStart(3, "0");
}

function generateDrillSongs(): {
  readonly pieces: readonly RawPiece[];
  readonly links: readonly RawLink[];
} {
  const pieces: RawPiece[] = [];
  const links: RawLink[] = [];
  for (let n = 1; n <= DRILL_COUNT; n++) {
    const slug = `drill-song-${pad(n)}`;
    const title = `Drill Song ${pad(n)}`;
    pieces.push({
      slug,
      title,
      kind: "song",
      conservation_status: "unassessed",
      is_stub: false,
      notes_md: null,
      version_notes_md: null,
      licensing_status: "unknown",
      licensing_notes_md: null,
      aliases: [],
      terms: ["joyful", "sca-pieces"],
      credits: [
        {
          role: "lyrics",
          attribution: "named",
          certainty: "certain",
          person: DRILL_BARD_SLUG,
        },
      ],
    });
    links.push({
      owner: { kind: "piece", slug },
      url: `https://drill.example/${pad(n)}`,
      title: `${title}, practice notes`,
      description: null,
      platform: null,
      place_type: "community_archive",
      collection: DRILL_BOOK_ID,
      locator: `No. ${n}`,
      liveness: "unknown",
      last_checked_at: null,
      archived_url: null,
      roles: ["text"],
      performances:
        n <= DRILL_PERFORMANCE_COUNT
          ? [
              {
                year: 2026,
                uploader: null,
                description_verbatim: `Practice run ${n}.`,
                event: MUSTER_FIELD_SLUG,
                performers: [DRILL_BARD_SLUG],
              },
            ]
          : [],
    });
  }
  return { pieces, links };
}

const DRILL = generateDrillSongs();

export const DRILL_PIECES: readonly RawPiece[] = DRILL.pieces;
export const DRILL_LINKS: readonly RawLink[] = DRILL.links;
