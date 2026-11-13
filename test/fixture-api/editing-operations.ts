import type { components } from "../../app/api/schema.gen";
import { collectionRef, COLLECTIONS } from "./catalogue/collections";
import { eventSummary, EVENTS } from "./catalogue/events";
import { LINKS, type RawLink } from "./catalogue/links";
import { listedPerson, PERSONS } from "./catalogue/persons";
import { PIECES, pieceSummary } from "./catalogue/pieces";
import { REVISIONS } from "./catalogue/revisions";
import { TERMS, termSummary } from "./catalogue/terms";
import { errorBody, type FixtureResponse } from "./responses";

/**
 * The fixture API's editing operations: each public entity's editable
 * document (built from the raw catalogue), `submitRevision`,
 * `listMyRevisions` and `withdrawRevision`, with the submitted revisions
 * kept per user. Its rules are only those the editors' tests and journeys
 * need: a blank title or name is 422 `required`; a new entity whose name
 * folds equal to a public one's is 409 `possible_duplicate` unless
 * acknowledged. An approved revision (a moderator's own) becomes its
 * entity's current revision, the base its next edit starts from.
 */

type Schemas = components["schemas"];
type EntityType = Schemas["EntityType"];
type User = Schemas["User"];
type Document = Schemas["EditorDocument"];

/** Each user's revisions, newest last. */
export type RevisionStore = Map<string, Schemas["RevisionView"][]>;

/** Each entity's current revision once one is approved here, by `type:key`. */
type CurrentRevisions = Map<string, number>;

const NOW = "2026-11-01T12:00:00Z";
const FIRST_ID = 2001;

const linksOf = (kind: "piece" | "person", slug: string) =>
  LINKS.filter(l => l.owner.kind === kind && l.owner.slug === slug);

const editorLink = ({ collection, performances, ...link }: RawLink) => ({
  url: link.url,
  title: link.title,
  description: link.description,
  platform: link.platform,
  place_type: link.place_type,
  collection_id: collection,
  locator: link.locator,
  roles: [...link.roles],
  performances: performances.map(p => ({
    event_slug: p.event,
    year: p.year,
    uploader: p.uploader,
    description_verbatim: p.description_verbatim,
    performer_slugs: [...p.performers],
  })),
});

// Editable documents ----------------------------------------------------------

const DOCUMENTS: Readonly<
  Record<EntityType, (key: string) => Document | undefined>
> = {
  piece: slug => {
    const raw = PIECES.find(p => p.slug === slug);
    if (!raw) return undefined;
    return {
      schema_version: 1,
      title: raw.title,
      kind: raw.kind,
      conservation_status: raw.conservation_status,
      is_stub: raw.is_stub,
      notes_md: raw.notes_md,
      version_notes_md: raw.version_notes_md,
      licensing_status: raw.licensing_status,
      licensing_notes_md: raw.licensing_notes_md,
      aliases: raw.aliases.map(({ text, kind }) => ({ text, kind })),
      term_slugs: [...raw.terms],
      credits: raw.credits.map(({ person, ...credit }) => ({
        ...credit,
        person_slug: person,
      })),
      links: linksOf("piece", slug).map(editorLink),
    };
  },
  person: slug => {
    const raw = PERSONS.find(p => p.slug === slug);
    if (!raw) return undefined;
    const { profile } = raw;
    return {
      schema_version: 1,
      name: raw.name,
      kind: raw.kind,
      status: raw.status,
      notes_md: profile?.notes_md ?? null,
      licensing_status: profile?.licensing_status ?? "unknown",
      licensing_notes_md: profile?.licensing_notes_md ?? null,
      is_stub: raw.is_stub,
      aliases: (profile?.aliases ?? []).map(({ name, kind }) => ({
        name,
        kind,
      })),
      roles: [...(profile?.roles ?? [])],
      affiliation_slugs: [...(profile?.affiliations ?? [])],
      links: linksOf("person", slug).map(link => {
        const { performances, ...rest } = editorLink(link);
        return {
          ...rest,
          performances: performances.map(p => ({ piece_slug: null, ...p })),
        };
      }),
    };
  },
  term: slug => {
    const raw = TERMS.find(t => t.slug === slug);
    if (!raw) return undefined;
    return {
      schema_version: 1,
      facet: raw.facet,
      name: raw.name,
      display_name: raw.display_name,
      parent_slug: raw.parent,
      related_affiliation_slug: raw.related_affiliation,
      description_md: raw.description_md,
      position: TERMS.filter(
        t => t.facet === raw.facet && t.parent === raw.parent
      ).indexOf(raw),
    };
  },
  collection: id => {
    const raw = COLLECTIONS.find(c => String(c.id) === id);
    if (!raw) return undefined;
    return {
      schema_version: 1,
      name: raw.name,
      url: raw.url,
      kind: raw.kind,
      description_md: raw.description_md,
      region_term_slug: raw.region,
    };
  },
  event: slug => {
    const raw = EVENTS.find(e => e.slug === slug);
    if (!raw) return undefined;
    return { schema_version: 1, name: raw.name };
  },
};

/** Each entity's key and its documents' names, to find duplicates by. */
const KEYS: Readonly<
  Record<EntityType, readonly { key: string; name: string }[]>
> = {
  piece: PIECES.map(p => ({ key: p.slug, name: p.title })),
  person: PERSONS.map(p => ({ key: p.slug, name: p.name })),
  term: TERMS.map(t => ({ key: t.slug, name: t.name })),
  collection: COLLECTIONS.map(c => ({ key: String(c.id), name: c.name })),
  event: EVENTS.map(e => ({ key: e.slug, name: e.name })),
};

const TYPE_OFFSETS: Readonly<Record<EntityType, number>> = {
  piece: 10000,
  person: 20000,
  term: 30000,
  collection: 40000,
  event: 50000,
};

/** An entity's base revision: its newest fixture revision, or one of its own. */
function baseOf(type: EntityType, key: string): number {
  const latest = REVISIONS.filter(
    r =>
      r.entity_type === type &&
      String("slug" in r.entity ? r.entity.slug : r.entity.id) === key
  ).at(-1);
  return (
    latest?.id ??
    TYPE_OFFSETS[type] + KEYS[type].findIndex(entry => entry.key === key)
  );
}

/** An entity's current revision: the newest approved here, or its base. */
export function currentBase(
  current: CurrentRevisions,
  type: EntityType,
  key: string
): number {
  return current.get(`${type}:${key}`) ?? baseOf(type, key);
}

/** The key of a revision's entity, or null for a new one. */
export function keyOf(revision: Schemas["RevisionView"]): string | null {
  const { entity } = revision;
  if (entity === null) return null;
  return "slug" in entity ? entity.slug : String(entity.id);
}

/** The entity a base revision is of: a canned revision, or one made here. */
function entityOfBase(store: RevisionStore, type: EntityType, base: number) {
  const made = [...store.values()]
    .flat()
    .find(r => r.entity_type === type && r.id === base);
  return made
    ? (keyOf(made) ?? undefined)
    : KEYS[type].find(({ key }) => baseOf(type, key) === base)?.key;
}

const SUMMARIES: Readonly<
  Record<EntityType, (key: string) => Schemas["RevisionView"]["entity"]>
> = {
  piece: pieceSummary,
  person: listedPerson,
  term: termSummary,
  collection: id => collectionRef(Number(id)),
  event: eventSummary,
};

export function getEditable(
  current: CurrentRevisions,
  type: EntityType,
  key: string
): FixtureResponse {
  const document = DOCUMENTS[type](key);
  if (!document) {
    return { status: 404, body: errorBody("not_found", `${type} not found`) };
  }
  return {
    status: 200,
    body: {
      entity_type: type,
      base_revision_id: currentBase(current, type, key),
      pending_revision_id: null,
      document,
    },
  };
}

// Submitting ------------------------------------------------------------------

const fold = (name: string) => name.trim().toLowerCase();

export function submitRevision(
  store: RevisionStore,
  current: CurrentRevisions,
  user: User,
  request: Schemas["SubmitRevisionRequest"]
): FixtureResponse {
  const { entity_type: type, base_revision_id: base, document } = request;
  const name = "title" in document ? document.title : document.name;
  const path = "title" in document ? "title" : "name";
  if (name.trim() === "") {
    return {
      status: 422,
      body: {
        code: "validation_failed",
        message: "the document does not validate",
        problems: [{ path, code: "required" }],
      },
    };
  }
  const key = base === null ? undefined : entityOfBase(store, type, base);
  if (base !== null && key === undefined) {
    return {
      status: 404,
      body: errorBody("not_found", "base revision not found"),
    };
  }
  const matches = KEYS[type].filter(entry => fold(entry.name) === fold(name));
  if (base === null && matches.length > 0 && !request.acknowledge_duplicates) {
    return {
      status: 409,
      body: {
        code: "possible_duplicate",
        message: "the new entity may duplicate public ones",
        possible_duplicates: matches.map(match => ({
          entity_type: type,
          slug: type === "collection" ? null : match.key,
          collection_id: type === "collection" ? Number(match.key) : null,
          name: match.name,
        })),
      },
    };
  }
  const approved = user.role === "moderator";
  const own = store.get(user.id) ?? [];
  const all = [...store.values()].flat();
  // A canned change of the type, so a review shows a diff.
  const change = REVISIONS.find(
    r => r.entity_type === type && r.base_snapshot !== null
  )!;
  const revision: Schemas["RevisionView"] = {
    entity_type: type,
    id: FIRST_ID + all.filter(r => r.id >= FIRST_ID).length,
    source: "user",
    summary: request.summary,
    author: { display_name: user.display_name },
    contributors: [],
    created_at: NOW,
    status: approved ? "approved" : "pending",
    review_note: null,
    reviewed_at: approved ? NOW : null,
    entity: key === undefined ? null : SUMMARIES[type](key),
    base_revision_id: base,
    snapshot: change.snapshot,
    base_snapshot: change.base_snapshot,
    changed_fields: change.changed_fields,
  };
  store.set(user.id, [...own, revision]);
  if (approved && key !== undefined) {
    current.set(`${type}:${key}`, revision.id);
  }
  return { status: 201, body: revision };
}

export function listMyRevisions(
  store: RevisionStore,
  user: User,
  query: URLSearchParams
): FixtureResponse {
  const status = query.get("status");
  const mine = (store.get(user.id) ?? [])
    .filter(r => status === null || r.status === status)
    .reverse();
  const offset = Number(query.get("offset") ?? 0);
  const limit = Number(query.get("limit") ?? 50);
  return {
    status: 200,
    body: {
      data: mine.slice(offset, offset + limit).map(r => ({
        id: r.id,
        entity_type: r.entity_type,
        entity: r.entity && {
          slug: "slug" in r.entity ? r.entity.slug : null,
          collection_id: "slug" in r.entity ? null : r.entity.id,
          name:
            "title" in r.entity
              ? r.entity.title
              : "name" in r.entity
                ? r.entity.name
                : r.entity.display_name,
        },
        status: r.status,
        summary: r.summary,
        created_at: r.created_at,
        review_note: r.review_note,
        reviewed_at: r.reviewed_at,
        is_stale: false,
        author: null,
      })),
      total: mine.length,
    },
  };
}

export function withdrawRevision(
  store: RevisionStore,
  user: User,
  id: string
): FixtureResponse {
  const mine = store.get(user.id) ?? [];
  const revision = mine.find(r => String(r.id) === id);
  if (!revision) {
    return { status: 404, body: errorBody("not_found", "revision not found") };
  }
  if (revision.status !== "pending") {
    return {
      status: 409,
      body: errorBody("revision_not_pending", "the revision is not pending"),
    };
  }
  store.set(
    user.id,
    mine.map(r => (r === revision ? { ...r, status: "withdrawn" } : r))
  );
  return { status: 204 };
}
