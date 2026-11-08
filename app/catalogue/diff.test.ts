import { describe, expect, it } from "vitest";
import type { Revision } from "~/schemas/catalogue";
import { revisionChanges, type DiffRow } from "./diff";

// The diff of each entity type's fields (plan §4.11): scalars, text,
// every list kind with added, removed and changed items, references, the
// person profile's expansion, no base, and §4.0's links as text.

type PieceRevision = Extract<Revision, { readonly entity_type: "piece" }>;
type PersonRevision = Extract<Revision, { readonly entity_type: "person" }>;
type PieceSnapshot = PieceRevision["snapshot"];
type PersonSnapshot = PersonRevision["snapshot"];

const META = {
  id: 2,
  base_revision_id: 1,
  source: "user",
  summary: "",
  author: { display_name: "Morwen of the Marches" },
  contributors: [],
  created_at: "2026-02-01T12:00:00Z",
} as const;

const KETTLE = {
  slug: "the-copper-kettle",
  title: "The Copper Kettle",
  kind: "song",
  secondary_kinds: [],
  conservation_status: "endangered",
  is_stub: false,
} as const;

const PIECE: PieceSnapshot = {
  title: "The Copper Kettle",
  kind: "song",
  secondary_kinds: [],
  conservation_status: "endangered",
  conservation_source_url: null,
  is_stub: false,
  notes_md: "Old notes.",
  version_notes_md: null,
  licensing_status: "unknown",
  licensing_notes_md: null,
  licence: null,
  historical_source_md: null,
  period_start: null,
  period_end: null,
  aliases: [{ text: "Old Copper", kind: "nickname" }],
  terms: [
    {
      term: { slug: "joyful", facet: "mood", display_name: "Joyful" },
      is_primary: false,
      part: null,
    },
  ],
  credits: [],
  relations: [],
  links: [
    {
      url: "https://video.example/kettle",
      title: "At the hearth",
      description: null,
      platform: "Videohall",
      place_type: "recording_platform",
      collection: null,
      locator: null,
      roles: ["performance"],
      performances: [],
    },
  ],
};

function piece(
  snapshot: Partial<PieceSnapshot>,
  base: PieceSnapshot | null,
  changed: PieceRevision["changed_fields"],
  entity: Partial<PieceRevision["entity"]> = {}
): PieceRevision {
  return {
    entity_type: "piece",
    entity: { ...KETTLE, ...entity },
    ...META,
    ...(base === null ? { base_revision_id: null } : {}),
    snapshot: { ...PIECE, ...snapshot },
    base_snapshot: base,
    changed_fields: changed,
  };
}

const row = (rows: readonly DiffRow[], field: string) =>
  rows.find(r => r.field === field);

describe("revisionChanges: a piece", () => {
  it("diffs scalars, labelling enums, null as none", () => {
    const { rows, first } = revisionChanges(
      piece(
        {
          kind: "poem",
          licence: "cc_by_sa",
          period_start: 1650,
          is_stub: true,
        },
        PIECE,
        ["is_stub", "kind", "licence", "period_start"]
      )
    );
    expect(first).toBe(false);
    expect(rows.map(r => r.label)).toEqual([
      "Stub",
      "Kind",
      "Licence",
      "Period from",
    ]);
    expect(row(rows, "kind")?.diff).toEqual({
      kind: "scalar",
      before: [{ kind: "text", text: "Song" }],
      after: [{ kind: "text", text: "Poem" }],
    });
    expect(row(rows, "licence")?.diff).toEqual({
      kind: "scalar",
      before: null,
      after: [
        { kind: "text", text: "Creative Commons Attribution-ShareAlike" },
      ],
    });
    expect(row(rows, "is_stub")?.diff).toMatchObject({
      before: [{ text: "No" }],
      after: [{ text: "Yes" }],
    });
  });

  it("gives text fields before and after as written", () => {
    const { rows } = revisionChanges(
      piece({ notes_md: "New *notes*." }, PIECE, ["notes_md"])
    );
    expect(row(rows, "notes_md")).toMatchObject({
      label: "Notes",
      diff: { kind: "text", before: "Old notes.", after: "New *notes*." },
    });
  });

  it("diffs lists by key: added, removed and changed", () => {
    const { rows } = revisionChanges(
      piece(
        {
          aliases: [{ text: "The Kettle Song", kind: "alt_title" }],
          terms: [
            {
              term: { slug: "joyful", facet: "mood", display_name: "Joyful" },
              is_primary: true,
              part: null,
            },
          ],
          credits: [
            {
              role: "tune",
              attribution: "named",
              certainty: "probable",
              part: "tune",
              note: null,
              person: {
                slug: "wren-of-the-vale",
                name: "Wren of the Vale",
                kind: "community_bard",
                is_stub: false,
              },
            },
          ],
          relations: [
            { type: "variant_of", piece: { ...KETTLE, slug: "x", title: "X" } },
          ],
          secondary_kinds: ["dance_music"],
        },
        PIECE,
        ["aliases", "credits", "relations", "secondary_kinds", "terms"]
      )
    );
    expect(row(rows, "aliases")?.diff).toEqual({
      kind: "list",
      added: [
        {
          key: "The Kettle Song\u0000alt_title",
          parts: [
            { kind: "text", text: "The Kettle Song" },
            { kind: "text", text: "Alternative title" },
          ],
        },
      ],
      removed: [
        {
          key: "Old Copper\u0000nickname",
          parts: [
            { kind: "text", text: "Old Copper" },
            { kind: "text", text: "Nickname" },
          ],
        },
      ],
      changed: [],
    });
    // The same term, now primary: changed, not added and removed.
    expect(row(rows, "terms")?.diff).toMatchObject({
      added: [],
      removed: [],
      changed: [
        {
          before: {
            parts: [
              { kind: "internal", to: "/categories/joyful" },
              { text: "Mood" },
            ],
          },
          after: {
            parts: [{ text: "Joyful" }, { text: "Mood" }, { text: "Primary" }],
          },
        },
      ],
    });
    expect(row(rows, "credits")?.diff).toMatchObject({
      added: [
        {
          parts: [
            { text: "Tune" },
            { kind: "internal", to: "/bards/wren-of-the-vale" },
            { text: "Tune" },
            { text: "Probably" },
          ],
        },
      ],
    });
    expect(row(rows, "relations")?.diff).toMatchObject({
      added: [
        {
          parts: [
            { text: "Variant of" },
            { kind: "internal", to: "/pieces/x" },
          ],
        },
      ],
    });
    expect(row(rows, "secondary_kinds")?.diff).toMatchObject({
      added: [{ parts: [{ text: "Dance music" }] }],
    });
  });

  it("links a link, and diffs it by its address", () => {
    const { rows, linksAsText } = revisionChanges(
      piece(
        {
          links: [
            {
              ...PIECE.links[0]!,
              title: "By the hearth",
              roles: ["performance", "lyrics"],
            },
          ],
        },
        PIECE,
        ["links"]
      )
    );
    expect(linksAsText).toBe(false);
    expect(row(rows, "links")?.diff).toMatchObject({
      changed: [
        {
          after: {
            parts: [
              {
                kind: "external",
                url: "https://video.example/kettle",
                text: "By the hearth",
              },
              { text: "Performance, Lyrics" },
              { text: "Recording platform" },
              { text: "Videohall" },
            ],
          },
        },
      ],
    });
  });

  it.each([
    [
      "restricted now",
      { conservation_status: "restricted" } as const,
      {},
      PIECE,
    ],
    [
      "restricted in its snapshot",
      {},
      { conservation_status: "restricted" } as const,
      PIECE,
    ],
    [
      "restricted in its base",
      {},
      {},
      { ...PIECE, conservation_status: "restricted" as const },
    ],
  ])("shows every link as text when %s", (_why, entity, snapshot, base) => {
    const changes = revisionChanges(
      piece(
        {
          ...snapshot,
          conservation_source_url: "https://assess.example/hoard",
          links: [
            {
              ...PIECE.links[0]!,
              url: "https://private.example/hoard",
              title: null,
            },
          ],
        },
        base,
        ["conservation_source_url", "links"],
        entity
      )
    );
    expect(changes.linksAsText).toBe(true);
    expect(JSON.stringify(changes)).not.toContain("external");
    expect(row(changes.rows, "links")?.diff).toMatchObject({
      added: [
        {
          parts: expect.arrayContaining([
            { kind: "text", text: "private.example" },
          ]),
        },
      ],
    });
    expect(row(changes.rows, "conservation_source_url")?.diff).toMatchObject({
      after: [{ kind: "text", text: "assess.example" }],
    });
  });

  it("never links an address that isn't http(s)", () => {
    const { rows } = revisionChanges(
      piece(
        {
          links: [
            { ...PIECE.links[0]!, url: "ftp://files.example/k", title: null },
          ],
        },
        PIECE,
        ["links"]
      )
    );
    expect(row(rows, "links")?.diff).toMatchObject({
      added: [
        {
          parts: expect.arrayContaining([
            { kind: "text", text: "files.example" },
          ]),
        },
      ],
    });
  });

  it("with no base, gives each changed field's value only", () => {
    const changes = revisionChanges(piece({}, null, ["aliases", "title"]));
    expect(changes.first).toBe(true);
    expect(row(changes.rows, "title")?.diff).toEqual({
      kind: "scalar",
      before: null,
      after: [{ kind: "text", text: "The Copper Kettle" }],
    });
    expect(row(changes.rows, "aliases")?.diff).toMatchObject({
      added: [{ parts: [{ text: "Old Copper" }, { text: "Nickname" }] }],
      removed: [],
    });
  });
});

const PROFILE: NonNullable<PersonSnapshot["profile"]> = {
  pronouns: "she/her",
  notes_md: null,
  licensing_status: "unknown",
  licensing_notes_md: null,
  aliases: [],
  roles: ["singer"],
  affiliations: [],
  relations: [],
  links: [],
};

const PERSON: PersonSnapshot = {
  name: "Wren of the Vale",
  kind: "community_bard",
  status: "active",
  status_date: null,
  status_source_url: null,
  is_stub: false,
  profile: PROFILE,
};

function person(
  snapshot: Partial<PersonSnapshot>,
  base: PersonSnapshot | null,
  changed: PersonRevision["changed_fields"]
): PersonRevision {
  return {
    entity_type: "person",
    entity: {
      slug: "wren-of-the-vale",
      name: "Wren of the Vale",
      kind: "community_bard",
      is_stub: false,
    },
    ...META,
    snapshot: { ...PERSON, ...snapshot },
    base_snapshot: base,
    changed_fields: changed,
  };
}

describe("revisionChanges: a person", () => {
  it("expands the profile into the sub-fields that differ", () => {
    const { rows } = revisionChanges(
      person(
        {
          status: "deceased",
          profile: {
            ...PROFILE,
            roles: ["singer", "poet"],
            affiliations: [
              {
                slug: "northmarch",
                facet: "affiliation",
                display_name: "Northmarch",
              },
            ],
          },
        },
        PERSON,
        ["profile", "status"]
      )
    );
    expect(rows.map(r => r.label)).toEqual([
      "Profile: Roles",
      "Profile: Affiliations",
      "Status",
    ]);
    expect(row(rows, "profile.roles")?.diff).toMatchObject({
      added: [{ parts: [{ text: "Poet" }] }],
    });
    expect(row(rows, "profile.affiliations")?.diff).toMatchObject({
      added: [{ parts: [{ kind: "internal", to: "/categories/northmarch" }] }],
    });
    expect(row(rows, "status")?.diff).toMatchObject({
      before: [{ text: "Active" }],
      after: [{ text: "Deceased" }],
    });
  });

  it("says Identity only for a side with no profile", () => {
    const { rows } = revisionChanges(
      person({ profile: null }, PERSON, ["profile"])
    );
    expect(row(rows, "profile")?.diff).toEqual({
      kind: "scalar",
      before: [{ kind: "text", text: "A full profile" }],
      after: [
        {
          kind: "text",
          text: "Identity only (the person prefers not to have a page)",
        },
      ],
    });
    expect(row(rows, "profile.pronouns")?.diff).toMatchObject({
      before: [{ text: "she/her" }],
      after: null,
    });
  });

  it("shows a link with performances as text, its pieces linked inside", () => {
    const { rows } = revisionChanges(
      person(
        {
          profile: {
            ...PROFILE,
            links: [
              {
                url: "https://video.example/wren",
                title: null,
                description: null,
                platform: null,
                place_type: null,
                collection: null,
                locator: null,
                roles: [],
                performances: [
                  {
                    piece: KETTLE,
                    year: 2024,
                    uploader: null,
                    description_verbatim: "",
                    event: null,
                    performers: [],
                  },
                ],
              },
              {
                url: "https://wren.example",
                title: "Wren’s site",
                description: null,
                platform: null,
                place_type: "author_site",
                collection: null,
                locator: null,
                roles: ["website"],
                performances: [],
              },
            ],
          },
        },
        PERSON,
        ["profile"]
      )
    );
    expect(row(rows, "profile.links")?.diff).toMatchObject({
      added: [
        {
          parts: [
            { kind: "text", text: "video.example" },
            {
              kind: "internal",
              to: "/pieces/the-copper-kettle",
              text: "The Copper Kettle",
            },
          ],
        },
        {
          parts: expect.arrayContaining([
            expect.objectContaining({
              kind: "external",
              url: "https://wren.example",
            }),
          ]),
        },
      ],
    });
  });

  it("with no base, lists the profile's non-empty sub-fields", () => {
    const changes = revisionChanges(person({}, null, ["name", "profile"]));
    expect(changes.rows.map(r => r.field)).toEqual([
      "name",
      "profile.pronouns",
      "profile.roles",
    ]);
  });
});

describe("revisionChanges: a term, a collection and an event", () => {
  it("diffs a term's references and aliases", () => {
    const war = { slug: "war", facet: "topic", display_name: "War" } as const;
    const snapshot = {
      facet: "topic",
      name: "Battles",
      display_name: "Battles",
      parent: war,
      related_affiliation: null,
      description_md: "Fights.",
      position: 1,
      aliases: ["Fights"],
    } as const;
    const { rows } = revisionChanges({
      entity_type: "term",
      entity: { slug: "battles", facet: "topic", display_name: "Battles" },
      ...META,
      snapshot,
      base_snapshot: { ...snapshot, parent: null, aliases: [], position: 2 },
      changed_fields: ["aliases", "parent", "position"],
    });
    expect(rows.map(r => r.label)).toEqual([
      "Also called",
      "Part of",
      "Position",
    ]);
    expect(row(rows, "parent")?.diff).toEqual({
      kind: "scalar",
      before: null,
      after: [{ kind: "internal", to: "/categories/war", text: "War" }],
    });
  });

  it("diffs a collection's address, region and parent", () => {
    const snapshot = {
      name: "The Northmarch Songbook",
      url: "https://songs.example/12",
      kind: "songbook_website",
      description_md: null,
      region: {
        slug: "northmarch",
        facet: "affiliation",
        display_name: "Northmarch",
      },
      parent: {
        id: 7,
        name: "Hall Recordings",
        kind: "youtube_channel",
        url: null,
        is_bardic_resource: false,
      },
      is_bardic_resource: true,
      enumerable: "yes",
    } as const;
    const { rows } = revisionChanges({
      entity_type: "collection",
      entity: { id: 12, name: "The Northmarch Songbook" },
      ...META,
      snapshot,
      base_snapshot: {
        ...snapshot,
        url: null,
        region: null,
        enumerable: "unknown",
      },
      changed_fields: ["enumerable", "region", "url"],
    });
    expect(row(rows, "url")?.diff).toMatchObject({
      after: [{ kind: "external", url: "https://songs.example/12" }],
    });
    expect(row(rows, "region")?.diff).toMatchObject({
      after: [{ to: "/categories/northmarch" }],
    });
    expect(row(rows, "enumerable")?.diff).toMatchObject({
      before: [{ text: "Not yet assessed" }],
      after: [{ text: "Yes" }],
    });
  });

  it("diffs an event's kind and description", () => {
    const snapshot = {
      name: "Revel",
      kind: "event",
      description_md: "Long.",
    } as const;
    const { rows } = revisionChanges({
      entity_type: "event",
      entity: { slug: "revel", name: "Revel", kind: "event" },
      ...META,
      snapshot,
      base_snapshot: { ...snapshot, kind: "venue", description_md: null },
      changed_fields: ["description_md", "kind"],
    });
    expect(rows.map(r => [r.label, r.diff.kind])).toEqual([
      ["Description", "text"],
      ["Kind", "scalar"],
    ]);
  });
});

describe("revisionChanges: text word by word", () => {
  it("diffs a changed text field word by word, and a first one not at all", () => {
    const { rows } = revisionChanges(
      piece(
        { notes_md: "Old notes, kept." },
        { ...PIECE, notes_md: "Old notes." },
        ["notes_md"]
      )
    );
    expect(rows[0]?.diff).toMatchObject({
      kind: "text",
      words: [
        { kind: "same", text: "Old " },
        { kind: "removed", text: "notes." },
        { kind: "added", text: "notes, kept." },
      ],
    });
    const first = revisionChanges(piece({}, null, ["notes_md"]));
    expect(first.rows[0]?.diff).toMatchObject({ kind: "text", words: null });
  });

  it("keeps a text over the bounds as two whole blocks", () => {
    const long = (seed: string) =>
      Array.from({ length: 2000 }, (_, i) => `${seed}${i}`).join(" ");
    const { rows } = revisionChanges(
      piece({ notes_md: long("b") }, { ...PIECE, notes_md: long("a") }, [
        "notes_md",
      ])
    );
    expect(rows[0]?.diff).toMatchObject({ kind: "text", words: null });
  });
});
