import type { components } from "../../../app/api/schema.gen";
import { DRILL_PIECES } from "./generated";
import { rawPerson } from "./persons";
import { rawTerm } from "./terms";

/**
 * The raw piece records of the fixture catalogue: about forty hand-written
 * pieces and the generated filler. Titles and notes are invented prose; there
 * are no lyrics anywhere. Every person credited is an invented stage name.
 */

type Schemas = components["schemas"];

type RawPieceTerm = Readonly<{
  /** A term slug. */
  term: string;
  is_primary: boolean;
  part: Schemas["PiecePart"] | null;
}>;

type RawCredit = Readonly<
  Omit<Schemas["PieceCredit"], "person"> & {
    /** A person slug, or null for traditional, unknown and so on. */
    person: string | null;
  }
>;

export type RawPiece = Readonly<
  Omit<
    Schemas["Piece"],
    | "aliases"
    | "terms"
    | "credits"
    | "relations"
    | "links"
    | "conservation_history"
    | "credit_names"
    | "updated_at"
  > & {
    aliases: readonly Schemas["PieceAlias"][];
    terms: readonly RawPieceTerm[];
    credits: readonly RawCredit[];
    /** Oldest first; its last entry is the current status. */
    conservation_history: readonly Schemas["ConservationChange"][];
  }
>;

/** One relation edge; both ends see it, with the direction flipped. */
export interface RawPieceRelation {
  readonly type: Schemas["PieceRelationType"];
  readonly from: string;
  readonly to: string;
}

type Kind = Schemas["PieceKind"];
type Status = Schemas["ConservationStatus"];

/** A term slug, optionally with the part of the piece it applies to. */
type TermSpec = string | readonly [slug: string, part: Schemas["PiecePart"]];

interface PieceOptions {
  readonly secondary?: readonly Kind[];
  readonly licence?: Schemas["Licence"];
  readonly stub?: boolean;
  readonly notes?: string;
  readonly versionNotes?: string;
  readonly licensingNotes?: string;
  readonly source?: string;
  readonly period?: readonly [start: number | null, end: number | null];
  readonly aliases?: readonly Schemas["PieceAlias"][];
  readonly credits?: readonly RawCredit[];
  readonly history?: readonly Schemas["ConservationChange"][];
}

/** A credit by a named person (or, with null, an unnamed source). */
function credit(
  person: string | null,
  role: Schemas["CreditRole"],
  extra: Partial<Omit<RawCredit, "person" | "role">> = {}
): RawCredit {
  return {
    role,
    attribution: person === null ? "traditional" : "named",
    certainty: "certain",
    part: null,
    note: null,
    person,
    ...extra,
  };
}

function change(
  status: Status,
  reason: string,
  at: string,
  sourceUrl: string | null = null
): Schemas["ConservationChange"] {
  return {
    conservation_status: status,
    reason,
    source_url: sourceUrl,
    at,
  };
}

function piece(
  slug: string,
  title: string,
  kind: Kind,
  status: Status,
  terms: readonly TermSpec[],
  options: PieceOptions = {}
): RawPiece {
  // The first origin term is the piece's primary origin.
  let primaryTaken = false;
  const pieceTerms = terms.map((spec): RawPieceTerm => {
    const [term, part] = typeof spec === "string" ? [spec, null] : spec;
    const isOrigin = rawTerm(term).facet === "origin";
    const is_primary = isOrigin && !primaryTaken;
    if (is_primary) primaryTaken = true;
    return { term, is_primary, part };
  });
  const licence = options.licence ?? null;
  return {
    slug,
    title,
    kind,
    secondary_kinds: [...(options.secondary ?? [])],
    conservation_status: status,
    is_stub: options.stub ?? false,
    notes_md: options.notes ?? null,
    version_notes_md: options.versionNotes ?? null,
    licensing_status: licence === null ? "unknown" : "known",
    licensing_notes_md: options.licensingNotes ?? null,
    licence,
    licence_version: null,
    historical_source_md: options.source ?? null,
    period_start: options.period?.[0] ?? null,
    period_end: options.period?.[1] ?? null,
    aliases: options.aliases ?? [],
    terms: pieceTerms,
    credits: options.credits ?? [],
    conservation_history: options.history ?? [],
  };
}

const HAND_PIECES: readonly RawPiece[] = [
  piece(
    "the-copper-kettle",
    "The Copper Kettle",
    "song",
    "endangered",
    [
      "traditional-and-folk",
      "joyful",
      "singalong",
      "drinking",
      "english",
      "ballad",
    ],
    {
      secondary: ["dance_music"],
      licence: "pd",
      notes:
        'Sung at *many* feasts; see [the tune index](https://collections.example/1).\n\n- The first verse is **short**\n- The chorus repeats\n\n<span class="raw">raw html must not render</span>',
      versionNotes: "This version has a slower chorus.",
      period: [1650, 1750],
      aliases: [
        { text: "The Kettle Song", kind: "alt_title" },
        { text: "Old Copper", kind: "nickname" },
        { text: "A Tavern Favourite", kind: "subtitle" },
        { text: "Copper Kettle (Ashdown)", kind: "redirect" },
      ],
      credits: [
        credit(null, "lyrics"),
        credit("wren-of-the-vale", "tune", {
          attribution: "named",
          certainty: "probable",
          part: "tune",
          note: "Arranged for three voices.",
        }),
        credit("aldith-of-ashdown", "arrangement", { certainty: "possible" }),
      ],
      history: [
        change(
          "unassessed",
          "Imported from the old wiki.",
          "2025-01-10T12:00:00Z"
        ),
        change(
          "endangered",
          "Known to only a few singers.",
          "2026-02-01T12:00:00Z",
          "https://assessments.example/kettle"
        ),
      ],
    }
  ),
  piece(
    "the-ashdown-wassail",
    "The Ashdown Wassail",
    "song",
    "low_risk",
    ["sca-pieces", "joyful", "singalong", "drinking", "ballad"],
    {
      licence: "cc_by",
      notes: "A wassail for the barony’s Twelfth Night.",
      period: [1998, null],
      credits: [credit(null, "tune", { part: "tune" })],
    }
  ),
  piece(
    "the-dragons-hoard",
    "The Dragon’s Hoard",
    "poem",
    "restricted",
    ["sca-pieces", "eerie", "war"],
    {
      licence: "arr",
      notes: "A narrative poem. Its creator asks that it is not shared.",
      credits: [credit("wren-of-the-vale", "author")],
      history: [
        change(
          "unassessed",
          "Imported from the old wiki.",
          "2025-01-10T12:00:00Z"
        ),
        change(
          "endangered",
          "Few people know the poem.",
          "2025-06-01T12:00:00Z"
        ),
        change(
          "restricted",
          "The creator asked that it not be recorded or shared.",
          "2026-04-02T12:00:00Z",
          "https://requests.example/statements/dragons-hoard"
        ),
      ],
    }
  ),
  piece(
    "the-silent-reel",
    "The Silent Reel",
    "dance_music",
    "restricted",
    ["sca-pieces", "relaxed"],
    {
      licence: "arr",
      history: [
        change(
          "unassessed",
          "Imported from the old wiki.",
          "2025-01-10T12:00:00Z"
        ),
        change(
          "restricted",
          "The composer asked for it to be withheld.",
          "2026-05-03T12:00:00Z"
        ),
      ],
    }
  ),
  piece("the-unfinished-lay", "The Unfinished Lay", "poem", "unassessed", [], {
    stub: true,
  }),
  piece(
    "the-long-road-north",
    "The Long Road North",
    "song",
    "unassessed",
    [
      "sca-pieces",
      "traditional-and-folk",
      "joyful",
      "sentimental",
      "relaxed",
      "comforting",
      "leaving-songs",
      "wandering",
      "love",
      "virtues",
      "english",
      "welsh",
      "ballad",
      "round",
      "middle-english",
    ],
    { licence: "cc_by_nc", period: [null, 1400] }
  ),
  piece(
    "1588-armada-ballad",
    "1588 Armada Ballad",
    "song",
    "low_risk",
    [
      ["pre-1600-sources", "words"],
      "16th-century",
      "war",
      "historical-people-and-events",
      "english",
      "ballad",
    ],
    {
      licence: "cc_by_sa",
      period: [1588, 1588],
      source: "Retold from a broadside of the year.",
    }
  ),
  piece(
    "donde-esta",
    "¿Dónde Está?",
    "song",
    "endangered",
    ["traditional-and-folk", "sentimental", "love", "spanish"],
    { licence: "cc_by_nd" }
  ),
  piece(
    "thorvalds-lament",
    "Þorvald’s Lament",
    "song",
    "endangered",
    ["pre-1600-sources", "12th-century", "tragic", "death", "norse"],
    {
      licence: "other",
      licensingNotes: "Permission was given by letter.",
      period: [1100, 1199],
    }
  ),
  piece(
    "tam-lins-daughter",
    "Tam Lin’s Daughter",
    "story",
    "critically_endangered",
    ["sca-pieces", "story-mood", "story-form", "gaelic", "fenian-cycle"],
    {
      licence: "cc_by_nc_nd",
      credits: [credit("jorund-skald", "author", { certainty: "disputed" })],
    }
  ),
  piece(
    "twelve-candles",
    "Twelve Candles",
    "song",
    "low_risk",
    ["sca-pieces", "joyful", "comforting"],
    {
      licence: "cc_by_nc_sa",
      credits: [credit(null, "lyrics", { attribution: "various" })],
    }
  ),
  piece(
    "the-tinkers-jig",
    "The Tinker’s Jig",
    "dance_music",
    "low_risk",
    ["traditional-and-folk", "joyful", "english"],
    {
      secondary: ["instrumental"],
      credits: [
        credit(null, "choreography", {
          attribution: "unknown",
          certainty: "possible",
        }),
      ],
    }
  ),
  piece(
    "tavern-round",
    "Tavern Round",
    "song",
    "low_risk",
    ["sca-pieces", "singalong", "drinking", "round"],
    { credits: [credit(null, "music", { attribution: "anonymous" })] }
  ),
  piece(
    "the-weeping-harper",
    "The Weeping Harper",
    "poem",
    "endangered",
    ["sca-pieces", "eerie", "tragic", "death"],
    { secondary: ["story"], credits: [credit("aldith-of-ashdown", "author")] }
  ),
  piece(
    "harvest-of-ravens",
    "Harvest of Ravens",
    "poem",
    "critically_endangered",
    ["sca-pieces", "eerie", "death"],
    { period: [null, null] }
  ),
  piece("harpers-weeping", "Harper’s Weeping", "song", "unassessed", [
    "sca-pieces",
    "tragic",
    "sentimental",
  ]),
  piece(
    "weeping-harper-air",
    "Weeping Harper Air",
    "instrumental",
    "unassessed",
    ["sca-pieces", "relaxed"]
  ),
  piece("kettle-and-tongs", "Kettle and Tongs", "dance_music", "unassessed", [
    "traditional-and-folk",
    "joyful",
  ]),
  piece(
    "filk-of-the-fallen-cake",
    "Filk of the Fallen Cake",
    "comedy",
    "unassessed",
    ["contrafacta-modern", "comedic", "rude", "filk"],
    { secondary: ["song"] }
  ),
  piece(
    "a-fair-wind-from-caer-wyn",
    "A Fair Wind from Caer Wyn",
    "song",
    "low_risk",
    ["sca-pieces", "leaving-songs", "wandering", "welsh"]
  ),
  piece(
    "ballad-of-the-broken-banner",
    "Ballad of the Broken Banner",
    "song",
    "endangered",
    ["sca-pieces", "warlike", "war", "battles", "ballad"]
  ),
  piece(
    "bold-sir-aldric",
    "Bold Sir Aldric",
    "comedy",
    "critically_endangered",
    ["contrafacta-sca", "comedic", "swords"]
  ),
  piece(
    "cadocs-hunting-horn",
    "Cadoc’s Hunting Horn",
    "instrumental",
    "low_risk",
    ["13th-century", "relaxed"]
  ),
  piece("cancao-do-mar", "Canção do Mar", "song", "unassessed", [
    "traditional-and-folk",
    "sentimental",
    "portuguese",
  ]),
  piece(
    "dance-of-the-nine-candles",
    "Dance of the Nine Candles",
    "dance_music",
    "endangered",
    ["18th-century", "joyful", "french"]
  ),
  piece(
    "eadrics-farewell",
    "Eadric’s Farewell",
    "song",
    "critically_endangered",
    [
      "pre-1600-sources",
      "16th-century",
      "leaving-songs",
      "sentimental",
      "middle-english",
    ],
    {
      credits: [
        credit("eadric-of-thornwick", "lyrics", { certainty: "probable" }),
      ],
    }
  ),
  piece("fields-of-thorn", "Fields of Thorn", "song", "low_risk", [
    "sca-pieces",
    "warlike",
    "swords",
  ]),
  piece("finns-hunt", "Finn’s Hunt", "story", "endangered", [
    "traditional-and-folk",
    "story-mood",
    "story-form",
    "gaelic",
    "fenian-cycle",
  ]),
  piece(
    "greywater-reel",
    "Greywater Reel",
    "instrumental",
    "low_risk",
    ["sca-pieces", "joyful"],
    { credits: [credit("the-greywater-minstrels", "music")] }
  ),
  piece(
    "a-green-knight-retold",
    "A Green Knight Retold",
    "story",
    "unassessed",
    ["20th-century", "story-mood", "story-form", "arthuriana"]
  ),
  piece(
    "hands-across-the-hall",
    "Hands Across the Hall",
    "poem",
    "unassessed",
    ["sca-pieces", "relaxed", "asl"]
  ),
  piece(
    "jorunds-saga",
    "Jorund’s Saga",
    "story",
    "endangered",
    ["sca-pieces", "story-mood", "norse", "story-form"],
    {
      credits: [
        credit("jorund-skald", "author"),
        credit("jorund-of-the-north-shore", "translation", {
          certainty: "possible",
        }),
      ],
    }
  ),
  piece(
    "lament-for-the-lost-shire",
    "Lament for the Lost Shire",
    "song",
    "low_risk",
    ["sca-pieces", "tragic", "sentimental"]
  ),
  piece(
    "maelgwns-harp",
    "Maelgwn’s Harp",
    "instrumental",
    "critically_endangered",
    ["12th-century", "12th-century-topic", "welsh", "relaxed"],
    {
      credits: [
        credit("maelgwn-the-harper", "music", {
          attribution: "named",
          certainty: "disputed",
        }),
      ],
    }
  ),
  piece(
    "midwinter-carol",
    "Midwinter Carol",
    "song",
    "low_risk",
    ["sca-pieces", "joyful", "singalong", "comforting"],
    {
      credits: [
        credit("wren-of-the-vale", "lyrics"),
        credit("dafydd-pennar", "tune"),
      ],
    }
  ),
  piece(
    "northmarch-rising",
    "Northmarch Rising",
    "song",
    "low_risk",
    ["sca-pieces", "warlike", "singalong"],
    { credits: [credit("northmarch-bards", "arrangement")] }
  ),
  piece(
    "old-man-of-the-marsh",
    "Old Man of the Marsh",
    "comedy",
    "endangered",
    ["traditional-and-folk", "comedic", "english"]
  ),
  piece("peerage-squires-oath", "Peerage Squire’s Oath", "poem", "unassessed", [
    "sca-pieces",
    "squires",
    "virtues",
  ]),
  piece(
    "rolling-home-to-westerfell",
    "Rolling Home to Westerfell",
    "song",
    "endangered",
    ["sca-pieces", "leaving-songs", "wandering"]
  ),
  piece("squires-round", "Squire’s Round", "song", "unassessed", [
    "sca-pieces",
    "squires",
    "round",
  ]),
  piece(
    "sweet-love-of-caer-wyn",
    "Sweet Love of Caer Wyn",
    "song",
    "low_risk",
    ["traditional-and-folk", "romantic", "welsh-language", "love"]
  ),
  piece("vigil-hymn", "Vigil Hymn", "song", "critically_endangered", [
    "sca-pieces",
    "relaxed",
    "comforting",
    "virtues",
  ]),
  piece("wandering-wil", "Wandering Wil", "song", "unassessed", [
    "20th-century",
    "wandering",
    "contrafacta",
  ]),
  piece("yule-rising", "Yule Rising", "song", "unassessed", [
    "sca-pieces",
    "joyful",
  ]),
];

/** Every piece, hand-written then generated. */
export const PIECES: readonly RawPiece[] = [...HAND_PIECES, ...DRILL_PIECES];

/** The relations, all four types. */
export const PIECE_RELATIONS: readonly RawPieceRelation[] = [
  { type: "variant_of", from: "kettle-and-tongs", to: "the-copper-kettle" },
  {
    type: "contrafactum_of",
    from: "filk-of-the-fallen-cake",
    to: "the-copper-kettle",
  },
  { type: "setting_of", from: "weeping-harper-air", to: "the-weeping-harper" },
  {
    type: "same_text_other_form",
    from: "harpers-weeping",
    to: "the-weeping-harper",
  },
];

const BY_SLUG: ReadonlyMap<string, RawPiece> = new Map(
  PIECES.map(p => [p.slug, p])
);

/** The piece with this slug; throws for a slug that isn't in the catalogue. */
export function rawPiece(slug: string): RawPiece {
  const found = BY_SLUG.get(slug);
  if (!found) throw new Error(`no such piece: ${slug}`);
  return found;
}

/** Up to five credited persons, as summaries name them. */
function creditNames(slug: string): string[] {
  const names = rawPiece(slug).credits.flatMap(c =>
    c.person === null ? [] : [rawPerson(c.person).name]
  );
  return [...new Set(names)].slice(0, 5);
}

/** A piece as other entities refer to it. */
export function pieceSummary(slug: string): Schemas["PieceSummary"] {
  const { title, kind, secondary_kinds, conservation_status, is_stub } =
    rawPiece(slug);
  return {
    slug,
    title,
    kind,
    secondary_kinds,
    conservation_status,
    is_stub,
    credit_names: creditNames(slug),
  };
}
