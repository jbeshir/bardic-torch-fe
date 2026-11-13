import type { components } from "../../../app/api/schema.gen";
import { collectionRef, rawCollection } from "./collections";
import { eventSummary, MIDWINTER_REVEL_SLUG, rawEvent } from "./events";
import { LINKS, performanceSummary, type RawLink } from "./links";
import { personSummary, rawPerson } from "./persons";
import { pieceSummary, rawPiece } from "./pieces";
import { rawTerm, termSummary } from "./terms";

/**
 * The raw revisions of the fixture catalogue, as the backend stores them
 * . For each of the five entity
 * types there is an `import` revision (no author, base null) and a `user`
 * revision based on it. Ids start at 1001; 1003 is the piece diff the e2e
 * uses. Every revision here is approved: only those are served.
 */

type Schemas = components["schemas"];
type Revision = Schemas["Revision"];

const CONTRIBUTORS = ["Archivist", "Lorekeeper"] as const;
const IMPORTED_AT = "2025-01-10T12:00:00Z";

function isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === false ||
    value === 0 ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** The spec's rule: fields that differ from the base's or, with no base, aren't empty. */
function changedFields<K extends string>(
  snapshot: Readonly<Record<K, unknown>>,
  base: Readonly<Record<K, unknown>> | null
): K[] {
  const keys = (Object.keys(snapshot) as K[]).sort();
  return keys.filter(key =>
    base === null
      ? !isEmpty(snapshot[key])
      : JSON.stringify(snapshot[key]) !== JSON.stringify(base[key])
  );
}

// Snapshots ----------------------------------------------------------------

function snapshotLink(raw: RawLink): Schemas["SnapshotPieceLink"] {
  return {
    url: raw.url,
    title: raw.title,
    description: raw.description,
    platform: raw.platform,
    place_type: raw.place_type,
    collection: raw.collection === null ? null : collectionRef(raw.collection),
    locator: raw.locator,
    roles: [...raw.roles],
    performances: raw.performances.map(performanceSummary),
  };
}

interface PieceSnapshotOptions {
  readonly overrides?: Partial<Schemas["PieceSnapshot"]>;
}

function pieceSnapshot(
  slug: string,
  options: PieceSnapshotOptions = {}
): Schemas["PieceSnapshot"] {
  const raw = rawPiece(slug);
  return {
    title: raw.title,
    kind: raw.kind,
    conservation_status: raw.conservation_status,
    is_stub: raw.is_stub,
    notes_md: raw.notes_md,
    version_notes_md: raw.version_notes_md,
    licensing_status: raw.licensing_status,
    licensing_notes_md: raw.licensing_notes_md,
    aliases: [...raw.aliases],
    terms: raw.terms.map(termSummary),
    credits: raw.credits.map(c => ({
      ...c,
      person: c.person === null ? null : personSummary(c.person),
    })),
    links: LINKS.filter(
      l => l.owner.kind === "piece" && l.owner.slug === slug
    ).map(snapshotLink),
    ...options.overrides,
  };
}

function personSnapshot(
  slug: string,
  overrides: Partial<Schemas["PersonSnapshot"]> = {},
  profileOverrides: Partial<Schemas["PersonSnapshotProfile"]> = {}
): Schemas["PersonSnapshot"] {
  const raw = rawPerson(slug);
  const { profile } = raw;
  return {
    name: raw.name,
    kind: raw.kind,
    status: raw.status,
    is_stub: raw.is_stub,
    profile:
      profile === null
        ? null
        : {
            notes_md: profile.notes_md,
            licensing_status: profile.licensing_status,
            licensing_notes_md: profile.licensing_notes_md,
            aliases: profile.aliases.map(({ name, kind }) => ({ name, kind })),
            roles: [...profile.roles],
            affiliations: profile.affiliations.map(termSummary),
            links: LINKS.filter(
              l => l.owner.kind === "person" && l.owner.slug === slug
            ).map(l => ({ ...snapshotLink(l), performances: [] })),
            ...profileOverrides,
          },
    ...overrides,
  };
}

// Builders -----------------------------------------------------------------

interface Meta {
  readonly id: number;
  readonly createdAt: string;
  readonly summary?: string;
}

function importMeta(id: number) {
  return {
    id,
    base_revision_id: null,
    source: "import" as const,
    summary: "",
    author: null,
    contributors: [...CONTRIBUTORS],
    created_at: IMPORTED_AT,
  };
}

function userMeta(meta: Meta, base: number) {
  return {
    id: meta.id,
    base_revision_id: base,
    source: "user" as const,
    summary: meta.summary ?? "",
    author: { display_name: "Morwen of the Marches" },
    contributors: [],
    created_at: meta.createdAt,
  };
}

function pieceRevision(
  slug: string,
  head: ReturnType<typeof importMeta> | ReturnType<typeof userMeta>,
  snapshot: Schemas["PieceSnapshot"],
  base: Schemas["PieceSnapshot"] | null
): Schemas["PieceRevision"] {
  return {
    entity_type: "piece",
    entity: pieceSummary(slug),
    ...head,
    snapshot,
    base_snapshot: base,
    changed_fields: changedFields(snapshot, base),
  };
}

// Piece revisions ----------------------------------------------------------

const KETTLE_AT_IMPORT = pieceSnapshot("the-copper-kettle", {
  overrides: {
    title: "Copper Kettle",
    conservation_status: "unassessed",
    notes_md: "Sung at feasts.",
    version_notes_md: null,
    licensing_status: "unknown",
    aliases: [],
    terms: [termSummary("traditional-and-folk"), termSummary("drinking")],
    credits: [],
    links: [],
  },
});

const KETTLE_USER = pieceSnapshot("the-copper-kettle", {
  overrides: { version_notes_md: null },
});

const KETTLE_CURRENT = pieceSnapshot("the-copper-kettle");

const HOARD_AT_IMPORT = pieceSnapshot("the-dragons-hoard", {
  overrides: {
    conservation_status: "endangered",
    licensing_status: "unknown",
  },
});

// Person, term, collection and event revisions ------------------------------

const WREN_AT_IMPORT = personSnapshot(
  "wren-of-the-vale",
  {},
  {
    notes_md: "A singer.",
    aliases: [],
    links: [],
    roles: ["singer"],
    affiliations: [],
  }
);

const WREN_USER = personSnapshot(
  "wren-of-the-vale",
  {},
  {
    links: LINKS.filter(
      l => l.owner.kind === "person" && l.owner.slug === "wren-of-the-vale"
    ).map(l => ({
      ...snapshotLink(l),
      performances:
        l.url === "https://profiles.example/wren"
          ? [
              {
                piece: pieceSummary("the-dragons-hoard"),
                year: 2026,
                uploader: null,
                description_verbatim: "Spoken to a hushed field.",
                event: eventSummary("muster-field"),
                performers: [personSummary("wren-of-the-vale")],
              },
            ]
          : [],
    })),
  }
);

function warSnapshot(
  overrides: Partial<Schemas["TermSnapshot"]> = {}
): Schemas["TermSnapshot"] {
  const raw = rawTerm("war");
  return {
    facet: raw.facet,
    name: raw.name,
    display_name: raw.display_name,
    parent: null,
    related_affiliation: null,
    description_md: raw.description_md,
    position: 1,
    ...overrides,
  };
}

const WAR_AT_IMPORT = warSnapshot({ description_md: null });
const WAR_USER = warSnapshot();

function collectionSnapshot(
  id: number,
  overrides: Partial<Schemas["CollectionSnapshot"]> = {}
): Schemas["CollectionSnapshot"] {
  const raw = rawCollection(id);
  return {
    name: raw.name,
    url: raw.url,
    kind: raw.kind,
    description_md: raw.description_md,
    region: raw.region === null ? null : termSummary(raw.region),
    ...overrides,
  };
}

const SONGBOOK_AT_IMPORT = collectionSnapshot(12, {
  description_md: null,
  region: null,
});
const SONGBOOK_USER = collectionSnapshot(12);

const REVEL_AT_IMPORT: Schemas["EventSnapshot"] = { name: "Midwinter Revels" };
const REVEL_USER: Schemas["EventSnapshot"] = {
  name: rawEvent(MIDWINTER_REVEL_SLUG).name,
};

export const REVISIONS: readonly Revision[] = [
  pieceRevision("the-copper-kettle", importMeta(1001), KETTLE_AT_IMPORT, null),
  pieceRevision("the-dragons-hoard", importMeta(1002), HOARD_AT_IMPORT, null),
  pieceRevision(
    "the-copper-kettle",
    userMeta(
      {
        id: 1003,
        createdAt: "2026-02-01T12:00:00Z",
        summary: "Added the tune credit, links and the licensing",
      },
      1001
    ),
    KETTLE_USER,
    KETTLE_AT_IMPORT
  ),
  pieceRevision(
    "the-copper-kettle",
    userMeta({ id: 1004, createdAt: "2026-02-20T12:00:00Z" }, 1003),
    KETTLE_CURRENT,
    KETTLE_USER
  ),
  pieceRevision(
    "the-dragons-hoard",
    userMeta(
      {
        id: 1005,
        createdAt: "2026-04-02T12:00:00Z",
        summary: "Restricted at the creator’s request",
      },
      1002
    ),
    pieceSnapshot("the-dragons-hoard"),
    HOARD_AT_IMPORT
  ),
  {
    entity_type: "person",
    entity: personSummary("wren-of-the-vale"),
    ...importMeta(1006),
    snapshot: WREN_AT_IMPORT,
    base_snapshot: null,
    changed_fields: changedFields(WREN_AT_IMPORT, null),
  },
  {
    entity_type: "person",
    entity: personSummary("wren-of-the-vale"),
    ...userMeta(
      {
        id: 1007,
        createdAt: "2026-03-01T12:00:00Z",
        summary: "Filled in the profile",
      },
      1006
    ),
    snapshot: WREN_USER,
    base_snapshot: WREN_AT_IMPORT,
    changed_fields: changedFields(WREN_USER, WREN_AT_IMPORT),
  },
  {
    entity_type: "term",
    entity: termSummary("war"),
    ...importMeta(1008),
    snapshot: WAR_AT_IMPORT,
    base_snapshot: null,
    changed_fields: changedFields(WAR_AT_IMPORT, null),
  },
  {
    entity_type: "term",
    entity: termSummary("war"),
    ...userMeta(
      {
        id: 1009,
        createdAt: "2026-03-05T12:00:00Z",
        summary: "Described the term",
      },
      1008
    ),
    snapshot: WAR_USER,
    base_snapshot: WAR_AT_IMPORT,
    changed_fields: changedFields(WAR_USER, WAR_AT_IMPORT),
  },
  {
    entity_type: "collection",
    entity: collectionRef(12),
    ...importMeta(1010),
    snapshot: SONGBOOK_AT_IMPORT,
    base_snapshot: null,
    changed_fields: changedFields(SONGBOOK_AT_IMPORT, null),
  },
  {
    entity_type: "collection",
    entity: collectionRef(12),
    ...userMeta(
      {
        id: 1011,
        createdAt: "2026-03-10T12:00:00Z",
        summary: "Set the region and described it",
      },
      1010
    ),
    snapshot: SONGBOOK_USER,
    base_snapshot: SONGBOOK_AT_IMPORT,
    changed_fields: changedFields(SONGBOOK_USER, SONGBOOK_AT_IMPORT),
  },
  {
    entity_type: "event",
    entity: eventSummary(MIDWINTER_REVEL_SLUG),
    ...importMeta(1012),
    snapshot: REVEL_AT_IMPORT,
    base_snapshot: null,
    changed_fields: changedFields(REVEL_AT_IMPORT, null),
  },
  {
    entity_type: "event",
    entity: eventSummary(MIDWINTER_REVEL_SLUG),
    ...userMeta(
      {
        id: 1013,
        createdAt: "2026-03-12T12:00:00Z",
        summary: "Corrected the name",
      },
      1012
    ),
    snapshot: REVEL_USER,
    base_snapshot: REVEL_AT_IMPORT,
    changed_fields: changedFields(REVEL_USER, REVEL_AT_IMPORT),
  },
  pieceRevision(
    "the-copper-kettle",
    userMeta(
      {
        id: 1014,
        createdAt: "2026-03-20T12:00:00Z",
        summary: "Added a recording and a credit",
      },
      1004
    ),
    KETTLE_CURRENT,
    KETTLE_CURRENT
  ),
];
