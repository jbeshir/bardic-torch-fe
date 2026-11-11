import type { components } from "../../../app/api/schema.gen";

/**
 * The raw person records of the fixture catalogue. Every name is an invented
 * stage name; none comes from the real wiki. Works, performances and links
 * are derived from the piece, link and event records, so they live there.
 */

type Schemas = components["schemas"];

type RawProfile = Readonly<
  Omit<
    Schemas["PersonProfile"],
    | "aliases"
    | "affiliations"
    | "relations"
    | "links"
    | "works"
    | "works_total"
    | "performances"
    | "performances_total"
  > & {
    aliases: readonly Schemas["PersonAlias"][];
    /** Affiliation term slugs. */
    affiliations: readonly string[];
  }
>;

export type RawPerson = Readonly<
  Omit<Schemas["Person"], "profile"> & { profile: RawProfile | null }
>;

/** One relation edge; both ends see it, with the direction flipped. */
export interface RawPersonRelation {
  readonly type: Schemas["PersonRelationType"];
  readonly from: string;
  readonly to: string;
}

function profile(overrides: Partial<RawProfile> = {}): RawProfile {
  return {
    pronouns: null,
    notes_md: null,
    licensing_status: "unknown",
    licensing_notes_md: null,
    aliases: [],
    roles: [],
    affiliations: [],
    ...overrides,
  };
}

function person(
  slug: string,
  name: string,
  kind: Schemas["PersonKind"],
  overrides: Partial<RawPerson> = {}
): RawPerson {
  return {
    slug,
    name,
    kind,
    is_stub: false,
    status: "active",
    status_date: null,
    status_source_url: null,
    profile: profile(),
    ...overrides,
  };
}

export const PERSONS: readonly RawPerson[] = [
  person("wren-of-the-vale", "Wren of the Vale", "community_bard", {
    profile: profile({
      pronouns: "she/her",
      notes_md:
        "Sings in taverns and at **court**, and writes verse for the Barony of Ashdown.\n\n- Teaches the Thursday round\n- Keeps a *small* songbook",
      licensing_status: "known",
      licensing_notes_md: "Happy for songs to be shared with credit.",
      aliases: [
        { name: "Wren Vale-Singer", kind: "sca" },
        { name: "The Vale Sparrow", kind: "stage" },
      ],
      roles: ["singer", "songwriter", "storyteller"],
      affiliations: ["barony-of-ashdown"],
    }),
  }),
  person("hollis-fenn", "Hollis Fenn", "community_bard", {
    is_stub: true,
    status: "prefers_no_page",
    status_date: "2026-03-01",
    status_source_url: "https://requests.example/statements/12",
    profile: null,
  }),
  person("corwin-ashgrove", "Corwin Ashgrove", "community_bard", {
    is_stub: true,
    status: "prefers_no_page",
    status_date: "2026-05-14",
    profile: null,
  }),
  person("northmarch-bards", "Northmarch Bards", "group", {
    profile: profile({
      notes_md: "A loose company of singers who meet at *Midwinter Revel*.",
      licensing_status: "known",
      roles: ["singer", "musician"],
      affiliations: ["northmarch"],
    }),
  }),
  person(
    "brannoc-the-drillmaster",
    "Brannoc the Drillmaster",
    "community_bard",
    {
      profile: profile({
        notes_md: "Writes practice pieces for new singers.",
        roles: ["singer", "songwriter"],
        affiliations: ["northmarch"],
      }),
    }
  ),
  person("aldith-of-ashdown", "Aldith of Ashdown", "community_bard", {
    profile: profile({
      pronouns: "they/them",
      notes_md: "A harper and poet.",
      licensing_status: "known",
      aliases: [
        { name: "Aldie", kind: "nickname" },
        { name: "Aldith Reedpipe", kind: "former" },
      ],
      roles: ["instrumentalist", "poet"],
      affiliations: ["barony-of-ashdown", "northmarch"],
    }),
  }),
  person("dafydd-pennar", "Dafydd Pennar", "community_bard", {
    profile: profile({
      notes_md: "Learned most of their repertoire from **Wren of the Vale**.",
      aliases: [{ name: "Dafydd of the Pennar", kind: "redirect" }],
      roles: ["singer", "jester"],
      affiliations: ["caer-wyn"],
    }),
  }),
  person("tamsin-of-the-reeds", "Tamsin of the Reeds", "community_bard", {
    is_stub: true,
    profile: profile({ roles: ["dancer"] }),
  }),
  person("wynne-of-caer-wyn", "Wynne of Caer Wyn", "community_bard", {
    profile: profile({
      notes_md: "Sings in Welsh and English.",
      roles: ["singer"],
      affiliations: ["caer-wyn"],
    }),
  }),
  person("jorund-skald", "Jorund Skald", "community_bard", {
    profile: profile({
      notes_md: "Tells sagas.",
      roles: ["storyteller", "poet"],
      affiliations: ["westerfell"],
    }),
  }),
  person(
    "jorund-of-the-north-shore",
    "Jorund of the North Shore",
    "community_bard",
    {
      is_stub: true,
      profile: profile(),
    }
  ),
  person("eadric-of-thornwick", "Eadric of Thornwick", "historical", {
    status: "deceased",
    status_date: "1544-06-01",
    profile: profile({
      notes_md: "An invented minstrel of the sixteenth century.",
      roles: ["singer", "poet"],
    }),
  }),
  person("maelgwn-the-harper", "Maelgwn the Harper", "historical", {
    status: "deceased",
    status_date: "1198-01-01",
    profile: profile({ roles: ["instrumentalist"] }),
  }),
  person("the-greywater-minstrels", "The Greywater Minstrels", "group", {
    status: "deceased",
    status_date: "2019-09-01",
    profile: profile({
      notes_md: "Played at feasts in Westerfell until they disbanded.",
      roles: ["musician"],
      affiliations: ["shire-of-greywater"],
    }),
  }),
];

export const PERSON_RELATIONS: readonly RawPersonRelation[] = [
  { type: "member_of", from: "aldith-of-ashdown", to: "northmarch-bards" },
  { type: "member_of", from: "wren-of-the-vale", to: "northmarch-bards" },
  { type: "heir_of", from: "dafydd-pennar", to: "wren-of-the-vale" },
  { type: "same_as", from: "jorund-of-the-north-shore", to: "jorund-skald" },
];

const BY_SLUG: ReadonlyMap<string, RawPerson> = new Map(
  PERSONS.map(p => [p.slug, p])
);

/** The person with this slug; throws for a slug that isn't in the catalogue. */
export function rawPerson(slug: string): RawPerson {
  const found = BY_SLUG.get(slug);
  if (!found) throw new Error(`no such person: ${slug}`);
  return found;
}

/** A person as other entities refer to them. */
export function personSummary(slug: string): Schemas["PersonSummary"] {
  const { name, kind, is_stub } = rawPerson(slug);
  return { slug, name, kind, is_stub };
}
