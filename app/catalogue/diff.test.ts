import { describe, expect, it } from "vitest";
import type { Revision } from "~/schemas/catalogue";
import { revisionChanges, type DiffRow } from "./diff";

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

const LINK = {
  url: "https://video.example/kettle",
  title: "At the hearth",
  description: null,
  platform: "Videohall",
  place_type: "recording_platform",
  collection: null,
  locator: null,
  roles: ["performance"],
  performances: [],
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
  terms: [],
  credits: [],
  relations: [],
  links: [LINK],
};

const piece = (
  snapshot: Partial<PieceSnapshot>,
  base: PieceSnapshot | null,
  changed: PieceRevision["changed_fields"],
  status: PieceSnapshot["conservation_status"] = "endangered"
): PieceRevision => ({
  entity_type: "piece",
  entity: {
    slug: "the-copper-kettle",
    title: "The Copper Kettle",
    kind: "song",
    secondary_kinds: [],
    conservation_status: status,
    is_stub: false,
  },
  ...META,
  ...(base === null ? { base_revision_id: null } : {}),
  snapshot: { ...PIECE, ...snapshot },
  base_snapshot: base,
  changed_fields: changed,
});

const row = (rows: readonly DiffRow[], field: string) =>
  rows.find(r => r.field === field);

describe("revisionChanges: a piece", () => {
  it("lists rows in the page's order, not the API's, with enums labelled", () => {
    const { rows, first } = revisionChanges(
      piece({ kind: "poem", licence: "cc_by_sa" }, PIECE, ["licence", "kind"])
    );
    expect(first).toBe(false);
    expect(rows.map(r => r.label)).toEqual(["Kind", "Licence"]);
    expect(row(rows, "kind")?.diff).toMatchObject({
      before: [{ text: "Song" }],
      after: [{ text: "Poem" }],
    });
  });

  it("diffs lists by key, and a link by its address", () => {
    const { rows } = revisionChanges(
      piece(
        {
          aliases: [{ text: "The Kettle Song", kind: "alt_title" }],
          links: [{ ...LINK, title: "By the hearth" }],
        },
        PIECE,
        ["aliases", "links"]
      )
    );
    expect(row(rows, "aliases")?.diff).toMatchObject({
      added: [
        { parts: [{ text: "The Kettle Song" }, { text: "Alternative title" }] },
      ],
      removed: [{ parts: [{ text: "Old Copper" }, { text: "Nickname" }] }],
      changed: [],
    });
    expect(row(rows, "links")?.diff).toMatchObject({
      added: [],
      changed: [
        { after: { parts: [{ kind: "external", url: LINK.url }, {}, {}, {}] } },
      ],
    });
  });

  it("diffs a changed text word by word, a first one and an over-long one not at all", () => {
    const edit = (notes: string, base: string | null) =>
      revisionChanges(
        piece(
          { notes_md: notes },
          base === null ? null : { ...PIECE, notes_md: base },
          ["notes_md"]
        )
      ).rows[0]?.diff;
    expect(edit("Old notes, kept.", "Old notes.")).toMatchObject({
      words: [
        { kind: "same", text: "Old " },
        { kind: "removed", text: "notes." },
        { kind: "added", text: "notes, kept." },
      ],
    });
    expect(edit("New.", null)).toMatchObject({ words: null });
    const long = (seed: string) =>
      Array.from({ length: 2000 }, (_, i) => `${seed}${i}`).join(" ");
    expect(edit(long("b"), long("a"))).toMatchObject({ words: null });
  });

  it.each([
    ["restricted now", "restricted", PIECE, {}],
    [
      "restricted in its snapshot",
      "endangered",
      PIECE,
      { conservation_status: "restricted" },
    ],
    [
      "restricted in its base",
      "endangered",
      { ...PIECE, conservation_status: "restricted" },
      {},
    ],
  ] as const)(
    "shows every link as text when %s",
    (_why, status, base, snap) => {
      const changes = revisionChanges(
        piece(
          {
            ...snap,
            conservation_source_url: "https://assess.example/hoard",
            links: [{ ...LINK, url: "https://private.example/k" }],
          },
          base,
          ["conservation_source_url", "links"],
          status
        )
      );
      expect(changes.linksAsText).toBe(true);
      expect(JSON.stringify(changes.rows)).not.toContain("external");
      expect(JSON.stringify(changes.rows)).toContain("private.example");
    }
  );

  it("never links an address that isn't http(s)", () => {
    const { rows } = revisionChanges(
      piece({ links: [{ ...LINK, url: "ftp://files.example/k" }] }, PIECE, [
        "links",
      ])
    );
    expect(JSON.stringify(row(rows, "links")?.diff)).toMatch(
      /"added":\[\{"key":"ftp:[^\]]*"kind":"text"/
    );
  });

  it("with no base, gives each changed field's value only", () => {
    const changes = revisionChanges(piece({}, null, ["title"]));
    expect(changes.first).toBe(true);
    expect(row(changes.rows, "title")?.diff).toMatchObject({
      before: null,
      after: [{ text: "The Copper Kettle" }],
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

const person = (
  snapshot: Partial<PersonSnapshot>,
  base: PersonSnapshot | null,
  changed: PersonRevision["changed_fields"]
): PersonRevision => ({
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
});

describe("revisionChanges: a person", () => {
  it("expands the profile into the sub-fields that differ", () => {
    const { rows } = revisionChanges(
      person({ profile: { ...PROFILE, roles: ["singer", "poet"] } }, PERSON, [
        "profile",
      ])
    );
    expect(rows.map(r => r.field)).toEqual(["profile.roles"]);
  });

  it("says Identity only for a side with no profile", () => {
    const { rows } = revisionChanges(
      person({ profile: null }, PERSON, ["profile"])
    );
    expect(row(rows, "profile")?.diff).toMatchObject({
      before: [{ text: "A full profile" }],
      after: [{ text: expect.stringContaining("Identity only") }],
    });
  });
});
