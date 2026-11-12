import type { components } from "../../app/api/schema.gen";
import { LINKS } from "./catalogue/links";
import { PERSONS } from "./catalogue/persons";
import { PIECES } from "./catalogue/pieces";
import { REVISIONS } from "./catalogue/revisions";
import { currentBase, keyOf, type RevisionStore } from "./editing-operations";
import { errorBody, type FixtureResponse } from "./responses";

/**
 * The fixture API's moderation and contact operations: the queue, a
 * revision for review, approve and reject, the contact requests and the
 * contact form, finding and hiding a link, and blocking a user. A
 * revision is stale when its base is no longer its entity's current
 * revision (`currentBase`), so approving one edit makes another of the
 * same page stale. Its other rules are the few the pages show: a
 * non-moderator gets 403 `moderator_required`, and a moderator can't be
 * blocked.
 */

type Schemas = components["schemas"];
type User = Schemas["User"];
type RevisionView = Schemas["RevisionView"];

export type ModerationState = {
  readonly users: Map<string, User>;
  readonly revisions: RevisionStore;
  /** Each approved entity's current revision, by `type:key`. */
  readonly current: Map<string, number>;
  readonly contacts: Map<number, Schemas["ContactRequest"]>;
  readonly hiddenLinks: Set<number>;
};

const NOW = "2026-11-01T12:00:00Z";

/** The author of the seeded pending revisions: never signed in. */
const APPRENTICE = { id: "fixture|apprentice", display_name: "Elowen Quill" };

const canned = (id: number) => REVISIONS.find(r => r.id === id)!;

const pending = (
  id: number,
  summary: string,
  createdAt: string,
  revision: Pick<
    RevisionView,
    | "entity_type"
    | "entity"
    | "base_revision_id"
    | "snapshot"
    | "base_snapshot"
    | "changed_fields"
  >
): RevisionView => ({
  ...revision,
  id,
  source: "user",
  summary,
  author: { display_name: APPRENTICE.display_name },
  contributors: [],
  created_at: createdAt,
  status: "pending",
  review_note: null,
  reviewed_at: null,
});

const REVEL = canned(1013);

/**
 * Two pending edits by the apprentice: the kettle's, made on its first
 * revision (1003's change, so it is stale), and the revel's, on its
 * current revision.
 */
export const SEEDED_REVISIONS: readonly (readonly [string, RevisionView])[] = [
  [
    APPRENTICE.id,
    pending(
      1901,
      "Credited the tune and added links",
      "2026-10-20T09:00:00Z",
      canned(1003)
    ),
  ],
  [
    APPRENTICE.id,
    pending(1902, "Described the feast", "2026-10-22T18:30:00Z", {
      entity_type: REVEL.entity_type,
      entity: REVEL.entity,
      base_revision_id: REVEL.id,
      snapshot: {
        ...REVEL.snapshot,
        description_md:
          "Held each year at midwinter, with a bardic circle after the feast.",
      },
      base_snapshot: REVEL.snapshot,
      changed_fields: ["description_md"],
    }),
  ],
];

const contact = (
  id: number,
  fields: Partial<Schemas["ContactRequest"]>
): Schemas["ContactRequest"] => ({
  id,
  kind: "general",
  name: null,
  email: "reader@example.org",
  message: "",
  url: null,
  status: "open",
  created_at: "2026-10-25T10:00:00Z",
  resolution: null,
  ...fields,
});

export const SEEDED_CONTACTS: readonly Schemas["ContactRequest"][] = [
  contact(1, {
    kind: "link_report",
    message: "This recording has lyrics typed out under the video.",
    url: "https://video.example/watch/kettle-hearth",
    created_at: "2026-10-24T08:15:00Z",
  }),
  contact(2, {
    kind: "opt_out",
    name: "Brannoc",
    email: "brannoc@example.org",
    message: "I’d rather not have a page about me. Please take it down.",
    created_at: "2026-10-26T20:40:00Z",
  }),
  contact(3, {
    kind: "correction",
    message: "The Copper Kettle’s tune is older than the page says.",
    url: "https://bardictorch.org/pieces/the-copper-kettle",
    status: "resolved",
    resolution: {
      resolved_by: "fixture|moderator",
      resolved_at: "2026-10-21T12:00:00Z",
      note: "Fixed the date.",
    },
  }),
];

const forbidden = (user: User): FixtureResponse | null =>
  user.role === "moderator"
    ? null
    : {
        status: 403,
        body: errorBody(
          "moderator_required",
          "this endpoint requires the moderator role"
        ),
      };

const notFound = (what: string): FixtureResponse => ({
  status: 404,
  body: errorBody("not_found", `${what} not found`),
});

const page = <T>(items: readonly T[], query: URLSearchParams) => {
  const offset = Number(query.get("offset") ?? 0);
  const limit = Number(query.get("limit") ?? 50);
  return { data: items.slice(offset, offset + limit), total: items.length };
};

/** Every stored revision with its author's user ID, oldest first. */
function allRevisions(state: ModerationState) {
  return [...state.revisions]
    .flatMap(([userId, revisions]) => revisions.map(r => ({ userId, r })))
    .sort((a, b) => a.r.id - b.r.id);
}

/** The current revision of a revision's entity, when it isn't its base. */
function staleAgainst(state: ModerationState, revision: RevisionView) {
  const key = keyOf(revision);
  if (key === null || revision.status !== "pending") return null;
  const current = currentBase(state.current, revision.entity_type, key);
  return current === revision.base_revision_id ? null : current;
}

function displayName(state: ModerationState, userId: string) {
  return (
    [...state.users.values()].find(u => u.id === userId)?.display_name ??
    APPRENTICE.display_name
  );
}

export function listModerationQueue(
  state: ModerationState,
  user: User,
  query: URLSearchParams
): FixtureResponse {
  const refused = forbidden(user);
  if (refused) return refused;
  const pending = allRevisions(state).filter(({ r }) => r.status === "pending");
  return {
    status: 200,
    body: page(
      pending.map(({ userId, r }) => ({
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
        reviewed_at: r.reviewed_at,
        is_stale: staleAgainst(state, r) !== null,
        author: { user_id: userId, display_name: displayName(state, userId) },
      })),
      query
    ),
  };
}

function findRevision(state: ModerationState, id: string) {
  return allRevisions(state).find(({ r }) => String(r.id) === id);
}

export function getModerationRevision(
  state: ModerationState,
  user: User,
  id: string
): FixtureResponse {
  const refused = forbidden(user);
  if (refused) return refused;
  const found = findRevision(state, id);
  if (!found) return notFound("revision");
  const { userId, r } = found;
  const current = staleAgainst(state, r);
  // The stale kettle's current revision is a canned one; any other's is
  // the base's snapshot, which is all the fixture keeps.
  const currentSnapshot =
    current === null
      ? null
      : (REVISIONS.find(c => c.id === current)?.snapshot ?? r.base_snapshot);
  return {
    status: 200,
    body: {
      ...r,
      author_user_id: userId,
      current_revision_id: current,
      current_snapshot: currentSnapshot,
      changed_fields_since_current: current === null ? null : r.changed_fields,
      possible_duplicates: [],
    },
  };
}

/** Sets a pending revision's review, or answers why it can't. */
function review(
  state: ModerationState,
  user: User,
  id: string,
  decide: (revision: RevisionView) => RevisionView | FixtureResponse
): FixtureResponse {
  const refused = forbidden(user);
  if (refused) return refused;
  const found = findRevision(state, id);
  if (!found) return notFound("revision");
  const { userId, r } = found;
  if (r.status !== "pending") {
    return {
      status: 409,
      body: errorBody("revision_not_pending", "the revision is not pending"),
    };
  }
  const reviewed = decide(r);
  if (!("entity_type" in reviewed)) return reviewed;
  state.revisions.set(
    userId,
    (state.revisions.get(userId) ?? []).map(item =>
      item === r ? reviewed : item
    )
  );
  return { status: 204 };
}

export function approveRevision(
  state: ModerationState,
  user: User,
  id: string,
  body: Schemas["ApproveRevisionRequest"]
): FixtureResponse {
  return review(state, user, id, r => {
    if (staleAgainst(state, r) !== null && !body.acknowledge_stale) {
      return {
        status: 409,
        body: errorBody("stale_revision", "the entity has changed"),
      };
    }
    const key = keyOf(r);
    if (key !== null) state.current.set(`${r.entity_type}:${key}`, r.id);
    return { ...r, status: "approved", reviewed_at: NOW };
  });
}

export function rejectRevision(
  state: ModerationState,
  user: User,
  id: string,
  body: Schemas["RejectRevisionRequest"]
): FixtureResponse {
  return review(state, user, id, r => ({
    ...r,
    status: "rejected",
    reviewed_at: NOW,
    review_note: body.note,
  }));
}

export function listContactRequests(
  state: ModerationState,
  user: User,
  query: URLSearchParams
): FixtureResponse {
  const refused = forbidden(user);
  if (refused) return refused;
  const status = query.get("status") ?? "open";
  return {
    status: 200,
    body: page(
      [...state.contacts.values()].filter(c => c.status === status),
      query
    ),
  };
}

export function closeContactRequest(
  state: ModerationState,
  user: User,
  id: string,
  body: Schemas["CloseContactRequestRequest"]
): FixtureResponse {
  const refused = forbidden(user);
  if (refused) return refused;
  const request = state.contacts.get(Number(id));
  if (!request) return notFound("contact request");
  if (request.status !== "open") {
    return {
      status: 409,
      body: errorBody("conflict", "the contact request is not open"),
    };
  }
  state.contacts.set(request.id, {
    ...request,
    status: body.status,
    resolution: {
      resolved_by: user.id,
      resolved_at: NOW,
      note: body.note ?? null,
    },
  });
  return { status: 204 };
}

/** Stores a contact request; the fixture takes any Turnstile token. */
export function createContactRequest(
  state: ModerationState,
  body: Schemas["CreateContactRequest"]
): FixtureResponse {
  const id = Math.max(0, ...state.contacts.keys()) + 1;
  state.contacts.set(id, {
    id,
    kind: body.kind,
    name: body.name ?? null,
    email: body.email,
    message: body.message,
    url: body.url ?? null,
    status: "open",
    created_at: NOW,
    resolution: null,
  });
  return { status: 202 };
}

/** A link's ID is its place in LINKS, from 1. */
export function getModerationLink(
  state: ModerationState,
  user: User,
  query: URLSearchParams
): FixtureResponse {
  const refused = forbidden(user);
  if (refused) return refused;
  const url = (query.get("url") ?? "").trim().replace(/\/$/, "");
  const index = LINKS.findIndex(l => l.url.replace(/\/$/, "") === url);
  const link = LINKS[index];
  if (!link) return notFound("link");
  const { kind, slug } = link.owner;
  const title =
    kind === "piece"
      ? PIECES.find(p => p.slug === slug)?.title
      : PERSONS.find(p => p.slug === slug)?.name;
  return {
    status: 200,
    body: {
      id: index + 1,
      url: link.url,
      title: link.title,
      is_hidden: state.hiddenLinks.has(index + 1),
      liveness: link.liveness,
      attachments: [
        { entity_type: kind, slug, title: title ?? slug, roles: link.roles },
      ],
    },
  };
}

export function setLinkHidden(
  state: ModerationState,
  user: User,
  id: string,
  body: Schemas["SetLinkHiddenRequest"]
): FixtureResponse {
  const refused = forbidden(user);
  if (refused) return refused;
  const linkId = Number(id);
  if (!LINKS[linkId - 1]) return notFound("link");
  if (body.hidden) state.hiddenLinks.add(linkId);
  else state.hiddenLinks.delete(linkId);
  return { status: 204 };
}

export function setUserBlocked(
  state: ModerationState,
  user: User,
  userId: string
): FixtureResponse {
  const refused = forbidden(user);
  if (refused) return refused;
  const target =
    [...state.users.values()].find(u => u.id === userId) ??
    (userId === APPRENTICE.id
      ? { ...APPRENTICE, role: "contributor" as const }
      : undefined);
  if (!target) return notFound("user");
  if (target.role === "moderator") {
    return {
      status: 409,
      body: errorBody("conflict", "moderators cannot be blocked or unblocked"),
    };
  }
  return { status: 200, body: target };
}
