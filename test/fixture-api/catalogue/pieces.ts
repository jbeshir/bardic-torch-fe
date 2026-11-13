import type { components } from "../../../app/api/schema.gen";
import { DRILL_PIECES } from "./generated";
import { rawPerson } from "./persons";

/**
 * The raw piece records of the fixture catalogue: about forty hand-written
 * pieces and the generated filler. Titles and notes are invented prose; there
 * are no lyrics anywhere. Every person credited is an invented stage name.
 */

type Schemas = components["schemas"];

type RawCredit = Readonly<
  Omit<Schemas["PieceCredit"], "person"> & {
    /** A person slug, or null for traditional, unknown and so on. */
    person: string | null;
  }
>;

export type RawPiece = Readonly<
  Omit<
    Schemas["Piece"],
    "aliases" | "terms" | "credits" | "links" | "credit_names" | "updated_at"
  > & {
    aliases: readonly Schemas["PieceAlias"][];
    /** Term slugs, in order. */
    terms: readonly string[];
    credits: readonly RawCredit[];
  }
>;

type Kind = Schemas["PieceKind"];
type Status = Schemas["ConservationStatus"];

interface PieceOptions {
  /** The licensing is known. */
  readonly licensed?: boolean;
  readonly stub?: boolean;
  readonly notes?: string;
  readonly versionNotes?: string;
  readonly licensingNotes?: string;
  readonly aliases?: readonly Schemas["PieceAlias"][];
  readonly credits?: readonly RawCredit[];
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
    person,
    ...extra,
  };
}

function piece(
  slug: string,
  title: string,
  kind: Kind,
  status: Status,
  terms: readonly string[],
  options: PieceOptions = {}
): RawPiece {
  return {
    slug,
    title,
    kind,
    conservation_status: status,
    is_stub: options.stub ?? false,
    notes_md: options.notes ?? null,
    version_notes_md: options.versionNotes ?? null,
    licensing_status: options.licensed ? "known" : "unknown",
    licensing_notes_md: options.licensingNotes ?? null,
    aliases: options.aliases ?? [],
    terms,
    credits: options.credits ?? [],
  };
}

const HAND_PIECES: readonly RawPiece[] = [
  piece(
    "the-copper-kettle",
    "The Copper Kettle",
    "song",
    "endangered",
    ["traditional-and-folk", "joyful", "singalong", "drinking", "english"],
    {
      licensed: true,
      notes:
        'Sung at *many* feasts; see [the tune index](https://collections.example/1).\n\n- The first verse is **short**\n- The chorus repeats\n\n<span class="raw">raw html must not render</span>',
      versionNotes: "This version has a slower chorus.",
      aliases: [
        { text: "The Kettle Song", kind: "alt_title" },
        { text: "A Tavern Favourite", kind: "subtitle" },
        { text: "Copper Kettle (Ashdown)", kind: "redirect" },
      ],
      credits: [
        credit(null, "lyrics"),
        credit("wren-of-the-vale", "tune", {
          attribution: "named",
          certainty: "probable",
        }),
        credit("aldith-of-ashdown", "lyrics", { certainty: "possible" }),
      ],
    }
  ),
  piece(
    "the-ashdown-wassail",
    "The Ashdown Wassail",
    "song",
    "low_risk",
    ["sca-pieces", "joyful", "singalong", "drinking"],
    {
      licensed: true,
      notes: "A wassail for the barony’s Twelfth Night.",
      credits: [credit(null, "tune")],
    }
  ),
  piece(
    "the-dragons-hoard",
    "The Dragon’s Hoard",
    "poem",
    "restricted",
    ["sca-pieces", "eerie", "war"],
    {
      licensed: true,
      notes: "A narrative poem. Its creator asks that it is not shared.",
      credits: [credit("wren-of-the-vale", "author")],
    }
  ),
  piece(
    "the-silent-reel",
    "The Silent Reel",
    "dance_music",
    "restricted",
    ["sca-pieces", "relaxed"],
    { licensed: true }
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
      "middle-english",
    ],
    { licensed: true }
  ),
  piece(
    "1588-armada-ballad",
    "1588 Armada Ballad",
    "song",
    "low_risk",
    [
      "pre-1600-sources",
      "16th-century",
      "war",
      "historical-people-and-events",
      "english",
    ],
    { licensed: true }
  ),
  piece(
    "donde-esta",
    "¿Dónde Está?",
    "song",
    "endangered",
    ["traditional-and-folk", "sentimental", "love", "spanish"],
    { licensed: true }
  ),
  piece(
    "thorvalds-lament",
    "Þorvald’s Lament",
    "song",
    "endangered",
    ["pre-1600-sources", "12th-century", "tragic", "death", "norse"],
    {
      licensed: true,
      licensingNotes: "Permission was given by letter.",
    }
  ),
  piece(
    "tam-lins-daughter",
    "Tam Lin’s Daughter",
    "story",
    "critically_endangered",
    ["sca-pieces", "story-mood", "gaelic", "fenian-cycle"],
    {
      licensed: true,
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
      licensed: true,
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
      credits: [
        credit(null, "tune", {
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
    ["sca-pieces", "singalong", "drinking"],
    { credits: [credit(null, "tune", { attribution: "anonymous" })] }
  ),
  piece(
    "the-weeping-harper",
    "The Weeping Harper",
    "poem",
    "endangered",
    ["sca-pieces", "eerie", "tragic", "death"],
    { credits: [credit("aldith-of-ashdown", "author")] }
  ),
  piece(
    "harvest-of-ravens",
    "Harvest of Ravens",
    "poem",
    "critically_endangered",
    ["sca-pieces", "eerie", "death"]
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
    "song",
    "unassessed",
    ["contrafacta-modern", "comedic", "rude"]
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
    ["sca-pieces", "warlike", "war", "battles"]
  ),
  piece("bold-sir-aldric", "Bold Sir Aldric", "song", "critically_endangered", [
    "contrafacta-sca",
    "comedic",
    "swords",
  ]),
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
    "gaelic",
    "fenian-cycle",
  ]),
  piece(
    "greywater-reel",
    "Greywater Reel",
    "instrumental",
    "low_risk",
    ["sca-pieces", "joyful"],
    { credits: [credit("the-greywater-minstrels", "tune")] }
  ),
  piece(
    "a-green-knight-retold",
    "A Green Knight Retold",
    "story",
    "unassessed",
    ["20th-century", "story-mood", "arthuriana"]
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
    ["sca-pieces", "story-mood", "norse"],
    {
      credits: [
        credit("jorund-skald", "author"),
        credit("jorund-of-the-north-shore", "author", {
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
        credit("maelgwn-the-harper", "tune", {
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
    { credits: [credit("northmarch-bards", "tune")] }
  ),
  piece("old-man-of-the-marsh", "Old Man of the Marsh", "song", "endangered", [
    "traditional-and-folk",
    "comedic",
    "english",
  ]),
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
  const { title, kind, conservation_status, is_stub } = rawPiece(slug);
  return {
    slug,
    title,
    kind,
    conservation_status,
    is_stub,
    credit_names: creditNames(slug),
  };
}
