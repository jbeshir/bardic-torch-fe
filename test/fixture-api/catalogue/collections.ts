import type { components } from "../../../app/api/schema.gen";

/**
 * The raw collection records of the fixture catalogue: invented songbooks,
 * sites and channels, one of every kind.
 */

type Schemas = components["schemas"];

export type RawCollection = Readonly<
  Omit<
    Schemas["Collection"],
    "region" | "citations" | "citations_total" | "updated_at"
  > & {
    /** A term slug (an affiliation), or null. */
    region: string | null;
  }
>;

/** "The Drill Book", which cites every generated practice piece. */
export const DRILL_BOOK_ID = 9;
/** "The Northmarch Songbook" (the spec's example id). */
export const NORTHMARCH_SONGBOOK_ID = 12;

function collection(
  id: number,
  name: string,
  kind: Schemas["CollectionKind"],
  overrides: Partial<RawCollection> = {}
): RawCollection {
  return {
    id,
    name,
    kind,
    url: `https://collections.example/${id}`,
    description_md: null,
    region: null,
    ...overrides,
  };
}

export const COLLECTIONS: readonly RawCollection[] = [
  collection(1, "The Ashdown Tune Index", "index_or_link_list", {
    region: "barony-of-ashdown",
    description_md: "A hand-kept list of **tunes** sung in the barony.",
  }),
  collection(2, "Bardic Resources Wiki", "wiki"),
  collection(3, "Caer Wyn Songsheets", "songbook_pdf", {
    region: "caer-wyn",
  }),
  collection(4, "Crossing Tunes Blog", "blog"),
  collection(5, "Eastmarch Archive", "archived_songbook", {
    url: null,
  }),
  collection(6, "Greywater Pages", "website", {
    region: "shire-of-greywater",
  }),
  collection(7, "Hall Recordings", "youtube_channel"),
  collection(8, "Harvest Playlist", "youtube_playlist"),
  collection(DRILL_BOOK_ID, "The Drill Book", "hosted_document", {
    description_md: "Practice pieces for new singers, in *numbered* order.",
  }),
  collection(10, "Kingdom Songs Category", "wiki_category"),
  collection(11, "Lorekeeper’s Shared Songbook", "google_doc_songbook"),
  collection(
    NORTHMARCH_SONGBOOK_ID,
    "The Northmarch Songbook",
    "songbook_website",
    {
      region: "northmarch",
      description_md:
        "The songbook of the kingdom, with a *locator* for each entry.\n\n- Printed yearly\n- Online since the first edition",
    }
  ),
  collection(13, "2nd Northmarch Songbook", "songbook_pdf"),
  collection(14, "Westerfell Songbook Site", "songbook_website", {
    region: "westerfell",
  }),
];

const BY_ID: ReadonlyMap<number, RawCollection> = new Map(
  COLLECTIONS.map(c => [c.id, c])
);

/** The collection with this id; throws for an id that isn't in the catalogue. */
export function rawCollection(id: number): RawCollection {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`no such collection: ${id}`);
  return found;
}

/** A collection as other entities refer to it. */
export function collectionRef(id: number): Schemas["CollectionRef"] {
  return { id, name: rawCollection(id).name };
}
