import { describe, expect, it } from "vitest";
import type { Revision } from "~/schemas/catalogue";
import { revisionChanges } from "./diff";

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
  conservation_status: "endangered",
  is_stub: false,
  notes_md: "Old notes.",
  version_notes_md: null,
  licensing_status: "unknown",
  licensing_notes_md: null,
  aliases: [{ text: "A Tavern Favourite", kind: "subtitle" }],
  terms: [],
  credits: [],
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
    credit_names: [],
    conservation_status: status,
    is_stub: false,
  },
  ...META,
  ...(base === null ? { base_revision_id: null } : {}),
  snapshot: { ...PIECE, ...snapshot },
  base_snapshot: base,
  changed_fields: changed,
});

const PROFILE: NonNullable<PersonSnapshot["profile"]> = {
  notes_md: null,
  licensing_status: "unknown",
  licensing_notes_md: null,
  aliases: [],
  roles: ["singer"],
  affiliations: [],
  links: [],
};

const PERSON: PersonSnapshot = {
  name: "Wren of the Vale",
  kind: "community_bard",
  status: "active",
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

const rows = (revision: Revision) =>
  revisionChanges(revision).rows.map(r => ({ ...r }));

describe("revisionChanges", () => {
  it("shows a scalar and a text field whole, in the page's order, with enums labelled", () => {
    expect(
      rows(
        piece({ kind: "poem", notes_md: "New notes." }, PIECE, [
          "notes_md",
          "kind",
        ])
      )
    ).toMatchObject([
      { label: "Kind", kind: "value", before: "Song", after: "Poem" },
      {
        label: "Notes",
        kind: "value",
        before: "Old notes.",
        after: "New notes.",
      },
    ]);
  });

  it("diffs a list by key: added, removed and changed", () => {
    expect(
      rows(
        piece(
          {
            aliases: [{ text: "The Kettle Song", kind: "alt_title" }],
            links: [{ ...LINK, title: "By the hearth" }],
          },
          PIECE,
          ["aliases", "links"]
        )
      )
    ).toMatchObject([
      {
        added: ["The Kettle Song · Alternative title"],
        removed: ["A Tavern Favourite · Subtitle"],
        changed: [],
      },
      {
        added: [],
        removed: [],
        changed: [
          {
            before: expect.stringContaining("At the hearth"),
            after: expect.stringContaining("By the hearth"),
          },
        ],
      },
    ]);
  });

  it("shows a link's title and address, but only its title or host when restricted", () => {
    const links = [{ ...LINK, url: "https://private.example/k", title: null }];
    expect(JSON.stringify(rows(piece({ links }, PIECE, ["links"])))).toContain(
      "https://private.example/k"
    );
    const restricted = revisionChanges(
      piece({ links }, PIECE, ["links"], "restricted")
    );
    expect(restricted.linksAsText).toBe(true);
    expect(JSON.stringify(restricted.rows)).not.toContain("https://");
    expect(JSON.stringify(restricted.rows)).toContain("private.example");
  });

  it("with no base, gives the new value only", () => {
    const changes = revisionChanges(piece({}, null, ["title"]));
    expect(changes.first).toBe(true);
    expect(changes.rows).toMatchObject([
      { kind: "value", before: null, after: "The Copper Kettle" },
    ]);
  });

  it("expands a person's profile into the sub-fields that differ", () => {
    expect(
      rows(
        person({ profile: { ...PROFILE, roles: ["singer", "poet"] } }, PERSON, [
          "profile",
        ])
      )
    ).toMatchObject([
      { field: "profile.roles", label: "Profile: Roles", added: ["Poet"] },
    ]);
  });

  it("says Identity only for a side with no profile", () => {
    expect(
      rows(person({ profile: null }, PERSON, ["profile"]))[0]
    ).toMatchObject({
      field: "profile",
      before: "A full profile",
      after: expect.stringContaining("Identity only"),
    });
  });

  it("hides the address of a person's link that carries performances", () => {
    const link = {
      ...LINK,
      performances: [{ year: 2025, notes: null, piece: null }],
    };
    const base = { ...PERSON, profile: { ...PROFILE, links: [] } };
    const text = JSON.stringify(
      rows(
        person({ profile: { ...PROFILE, links: [link] } } as never, base, [
          "profile",
        ])
      )
    );
    expect(text).not.toContain("https://");
  });
});
