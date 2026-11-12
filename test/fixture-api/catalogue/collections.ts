import type { components } from "../../../app/api/schema.gen";

/**
 * The raw collection records of the fixture catalogue: invented songbooks,
 * sites and channels, one of every kind and every `enumerable` value.
 */

type Schemas = components["schemas"];

export type RawCollection = Readonly<
  Omit<
    Schemas["Collection"],
    | "region"
    | "parent"
    | "children"
    | "citations"
    | "citations_total"
    | "updated_at"
  > & {
    /** A term slug (an affiliation), or null. */
    region: string | null;
    /** The parent collection's id, or null. */
    parent: number | null;
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
  enumerable: Schemas["CollectionEnumerable"],
  isBardicResource: boolean,
  overrides: Partial<RawCollection> = {}
): RawCollection {
  return {
    id,
    name,
    kind,
    url: `https://collections.example/${id}`,
    is_bardic_resource: isBardicResource,
    description_md: null,
    enumerable,
    region: null,
    parent: null,
    ...overrides,
  };
}

export const COLLECTIONS: readonly RawCollection[] = [
  collection(1, "The Ashdown Tune Index", "index_or_link_list", "yes", true, {
    region: "barony-of-ashdown",
    description_md: "A hand-kept list of **tunes** sung in the barony.",
  }),
  collection(2, "Bardic Resources Wiki", "wiki", "browser", true),
  collection(3, "Caer Wyn Songsheets", "songbook_pdf", "pdf", true, {
    region: "caer-wyn",
  }),
  collection(4, "Crossing Tunes Blog", "blog", "no", false),
  collection(5, "Eastmarch Archive", "archived_songbook", "unknown", false, {
    url: null,
  }),
  collection(6, "Greywater Pages", "website", "unknown", false, {
    region: "shire-of-greywater",
  }),
  collection(7, "Hall Recordings", "youtube_channel", "api", true),
  collection(8, "Harvest Playlist", "youtube_playlist", "browser", false, {
    parent: 7,
  }),
  collection(DRILL_BOOK_ID, "The Drill Book", "hosted_document", "pdf", true, {
    description_md: "Practice pieces for new singers, in *numbered* order.",
  }),
  collection(10, "Kingdom Songs Category", "wiki_category", "yes", true),
  collection(
    11,
    "Lorekeeper’s Shared Songbook",
    "google_doc_songbook",
    "browser",
    false
  ),
  collection(
    NORTHMARCH_SONGBOOK_ID,
    "The Northmarch Songbook",
    "songbook_website",
    "yes",
    true,
    {
      region: "northmarch",
      description_md:
        "The songbook of the kingdom, with a *locator* for each entry.\n\n- Printed yearly\n- Online since the first edition",
    }
  ),
  collection(13, "2nd Northmarch Songbook", "other", "no", true, {
    parent: NORTHMARCH_SONGBOOK_ID,
  }),
  collection(14, "Westerfell Songbook Site", "songbook_website", "yes", false, {
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
