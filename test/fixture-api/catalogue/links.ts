import type { components } from "../../../app/api/schema.gen";
import { NORTHMARCH_SONGBOOK_ID } from "./collections";
import {
  eventSummary,
  MIDWINTER_REVEL_SLUG,
  MUSTER_FIELD_SLUG,
} from "./events";
import { DRILL_LINKS } from "./generated";
import { personSummary } from "./persons";

/**
 * The raw link records of the fixture catalogue, for pieces and for persons,
 * with their performances. A link belongs to one owner.
 */

type Schemas = components["schemas"];

export type RawPerformance = Readonly<
  Omit<Schemas["PiecePerformance"], "event" | "performers"> & {
    /** An event slug, or null. */
    event: string | null;
    /** Person slugs. */
    performers: readonly string[];
  }
>;

interface LinkOwner {
  readonly kind: "piece" | "person";
  readonly slug: string;
}

export type RawLink = Readonly<
  Omit<Schemas["PieceLink"], "collection" | "performances"> & {
    owner: LinkOwner;
    /** A collection id, or null. */
    collection: number | null;
    performances: readonly RawPerformance[];
  }
>;

/** Where the restricted piece's links point (the e2e asserts none renders). */
const RESTRICTED_HOST = "private-recordings.example";

function link(
  owner: LinkOwner,
  url: string,
  overrides: Partial<Omit<RawLink, "owner" | "url">> = {}
): RawLink {
  return {
    owner,
    url,
    title: null,
    description: null,
    platform: null,
    place_type: null,
    collection: null,
    locator: null,
    liveness: "unknown",
    last_checked_at: null,
    archived_url: null,
    roles: ["other"],
    performances: [],
    ...overrides,
  };
}

function performance(
  year: number | null,
  description: string,
  overrides: Partial<RawPerformance> = {}
): RawPerformance {
  return {
    year,
    uploader: null,
    description_verbatim: description,
    event: null,
    performers: [],
    ...overrides,
  };
}

const piece = (slug: string): LinkOwner => ({ kind: "piece", slug });
const person = (slug: string): LinkOwner => ({ kind: "person", slug });

const CHECKED = "2026-10-01T09:30:00Z";

const HAND_LINKS: readonly RawLink[] = [
  // The Copper Kettle: three roles, a collection locator, performances,
  // and a dead link with an archive.
  link(
    piece("the-copper-kettle"),
    "https://video.example/watch/kettle-hearth",
    {
      title: "The Copper Kettle at the hearth",
      platform: "Videohall",
      place_type: "recording_platform",
      liveness: "ok",
      last_checked_at: CHECKED,
      roles: ["performance"],
      performances: [
        performance(2025, "A lively tavern take, filmed by the fire.", {
          uploader: "Pennon Tapper",
          event: "the-copper-hearth",
          performers: ["wren-of-the-vale", "northmarch-bards"],
        }),
        performance(null, "An undated take from a feast.", {
          performers: ["aldith-of-ashdown"],
        }),
      ],
    }
  ),
  link(piece("the-copper-kettle"), "https://collections.example/12/kettle", {
    title: "The Copper Kettle, with chords",
    place_type: "book",
    collection: NORTHMARCH_SONGBOOK_ID,
    locator: "p. 14",
    liveness: "ok",
    last_checked_at: CHECKED,
    roles: ["lyrics", "sheet_music", "text"],
  }),
  link(piece("the-copper-kettle"), "https://old-archive.example/kettle.html", {
    title: "An old copy of the words",
    place_type: "community_archive",
    liveness: "dead",
    last_checked_at: CHECKED,
    archived_url: "https://web-archive.example/2022/old-archive/kettle.html",
    roles: ["text_source"],
  }),

  // The Ashdown Wassail: dead with no archive, blocked, unknown.
  link(piece("the-ashdown-wassail"), "https://wassail.example/words", {
    title: "Words of the wassail",
    place_type: "author_site",
    liveness: "dead",
    last_checked_at: CHECKED,
    roles: ["lyrics"],
  }),
  link(piece("the-ashdown-wassail"), "https://shop.example/wassail-sheet", {
    title: "Wassail sheet music",
    liveness: "blocked",
    last_checked_at: CHECKED,
    roles: ["official", "sheet_music"],
  }),
  link(piece("the-ashdown-wassail"), "https://records.example/wassail", {
    title: "Wassail in the hall records",
    roles: ["translation"],
  }),
  link(
    piece("the-ashdown-wassail"),
    "https://video.example/watch/wassail-2024",
    {
      title: "The wassail at Twelfth Night",
      platform: "Videohall",
      place_type: "streaming",
      liveness: "ok",
      last_checked_at: CHECKED,
      roles: ["performance"],
      performances: [
        performance(2024, "Sung round the barony hall.", {
          uploader: "Ferrant of the Hall",
          event: "ashdown-twelfth-night",
          performers: ["aldith-of-ashdown"],
        }),
      ],
    }
  ),

  // The restricted piece: every link points at the restricted host.
  link(
    piece("the-dragons-hoard"),
    `https://${RESTRICTED_HOST}/hoard/recording`,
    {
      title: "The Dragon’s Hoard, live",
      platform: "Videohall",
      place_type: "recording_platform",
      liveness: "ok",
      last_checked_at: CHECKED,
      roles: ["performance"],
      performances: [
        performance(2026, "Spoken to a hushed field.", {
          uploader: "Pennon Tapper",
          event: MUSTER_FIELD_SLUG,
          performers: ["wren-of-the-vale"],
        }),
      ],
    }
  ),
  link(piece("the-dragons-hoard"), `https://${RESTRICTED_HOST}/hoard/revel`, {
    title: "The Dragon’s Hoard at the revel",
    place_type: "streaming",
    liveness: "dead",
    last_checked_at: CHECKED,
    archived_url: `https://web-archive.example/2025/${RESTRICTED_HOST}/hoard/revel`,
    roles: ["performance"],
    performances: [
      performance(2025, "Told before the feast.", {
        event: MIDWINTER_REVEL_SLUG,
        performers: ["wren-of-the-vale"],
      }),
    ],
  }),
  link(piece("the-dragons-hoard"), `https://${RESTRICTED_HOST}/hoard/text`, {
    title: "The text of the poem",
    collection: NORTHMARCH_SONGBOOK_ID,
    locator: "p. 31",
    place_type: "book",
    liveness: "ok",
    last_checked_at: CHECKED,
    roles: ["text", "licensing_source"],
  }),
  link(piece("the-silent-reel"), `https://${RESTRICTED_HOST}/reel/notation`, {
    title: "Notation",
    roles: ["sheet_music", "dance_instructions"],
  }),

  // Other pieces: the remaining roles, place types and performances.
  link(piece("the-long-road-north"), "https://writer.example/contact", {
    title: "Write to the author",
    roles: ["other"],
  }),
  link(piece("the-long-road-north"), "https://oral.example/tradition/road", {
    title: "How the song is passed on",
    roles: ["licensing_source"],
    liveness: "ok",
    last_checked_at: CHECKED,
  }),
  link(piece("midwinter-carol"), "https://video.example/watch/carol", {
    title: "Midwinter carol, sung",
    platform: "Videohall",
    place_type: "streaming",
    collection: NORTHMARCH_SONGBOOK_ID,
    locator: "p. 3",
    liveness: "ok",
    last_checked_at: CHECKED,
    roles: ["performance", "lyrics"],
    performances: [
      performance(2025, "The whole hall joined the chorus.", {
        uploader: "Ferrant of the Hall",
        event: MIDWINTER_REVEL_SLUG,
        performers: ["wren-of-the-vale", "dafydd-pennar", "northmarch-bards"],
      }),
    ],
  }),
  link(piece("northmarch-rising"), "https://collections.example/12/rising", {
    title: "Northmarch Rising",
    collection: NORTHMARCH_SONGBOOK_ID,
    locator: "p. 20",
    roles: ["text"],
    liveness: "ok",
    last_checked_at: CHECKED,
    performances: [
      performance(2023, "Opened the revel.", {
        event: MIDWINTER_REVEL_SLUG,
        performers: [],
      }),
    ],
  }),
  link(
    piece("a-green-knight-retold"),
    "https://translations.example/green-knight",
    {
      title: "A translation note",
      roles: ["translation"],
    }
  ),
  link(
    piece("sweet-love-of-caer-wyn"),
    "https://collections.example/3/sweet-love",
    {
      title: "Sweet Love, with a gloss",
      collection: 3,
      locator: "sheet 2",
      roles: ["translation", "lyrics"],
    }
  ),

  // Persons: websites and external profiles.
  link(person("wren-of-the-vale"), "https://wren-vale.example/", {
    title: "Wren’s songbook page",
    place_type: "author_site",
    liveness: "ok",
    last_checked_at: CHECKED,
    roles: ["website"],
  }),
  link(person("wren-of-the-vale"), "https://profiles.example/wren", {
    title: "Wren on the song hub",
    platform: "Songhub",
    place_type: "recording_platform",
    liveness: "ok",
    last_checked_at: CHECKED,
    roles: ["external_profile"],
  }),
  link(person("northmarch-bards"), "https://collections.example/12/bards", {
    title: "The Northmarch Bards listed in the songbook",
    collection: NORTHMARCH_SONGBOOK_ID,
    locator: "p. 2",
    roles: ["website"],
  }),
  link(person("aldith-of-ashdown"), "https://profiles.example/aldith", {
    title: "Aldith on the song hub",
    platform: "Songhub",
    roles: ["external_profile"],
  }),
];

/** A performance as a piece's link serves it (before redaction). */
export function performanceSummary(
  raw: RawPerformance
): Schemas["PiecePerformance"] {
  return {
    year: raw.year,
    uploader: raw.uploader,
    description_verbatim: raw.description_verbatim,
    event: raw.event === null ? null : eventSummary(raw.event),
    performers: raw.performers.map(personSummary),
  };
}

/** Every link: the hand-written ones, then the generated ones. */
export const LINKS: readonly RawLink[] = [...HAND_LINKS, ...DRILL_LINKS];
