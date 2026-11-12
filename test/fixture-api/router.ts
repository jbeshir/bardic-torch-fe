import type { components, operations } from "../../app/api/schema.gen";
import { CATALOGUE_READS } from "./catalogue-operations";
import { SEED_USERS, type SeedUserId } from "./data";
import {
  getEditable,
  listMyRevisions,
  type RevisionStore,
  submitRevision,
  withdrawRevision,
} from "./editing-operations";
import {
  approveRevision,
  closeContactRequest,
  createContactRequest,
  getModerationLink,
  getModerationRevision,
  listContactRequests,
  listModerationQueue,
  type ModerationState,
  rejectRevision,
  SEEDED_CONTACTS,
  SEEDED_REVISIONS,
  setLinkHidden,
  setUserBlocked,
} from "./moderation-operations";
import { errorBody, type FixtureResponse } from "./responses";
import { requestProblems, responseProblems } from "./spec";

/**
 * Routes a request to the fixture API's canned answers: `getHealthz`, the
 * seeded users' `getMe` and `updateMe`, the catalogue reads
 * (catalogue-operations.ts), the editing operations
 * (editing-operations.ts) and the moderation and contact operations
 * (moderation-operations.ts). A request is signed in by the bearer the app
 * sends for a stub session, exactly `Bearer fixture:<userId>`;
 * anything else is 401, except on the contact form, which needs no
 * account. A renamed user, each user's revisions, the contact requests
 * and the hidden links are remembered in the state; a JSON body that
 * breaks the spec is 400.
 *
 * Every answer is validated against the spec; a fixture that breaks the
 * contract throws instead of answering. It follows no backend rule beyond
 * what the read pages need: an unknown entity is 404, and a `term` or
 * `affiliation` that no listed term has is 400.
 */

export type FixtureState = ModerationState;

type FixtureRequest = {
  readonly method: string;
  readonly pathname: string;
  /** The raw query string, `?…` or empty (`URL.search`). */
  readonly search: string;
  readonly authorization: string | null;
  readonly body: string;
};

export function createFixtureState(): FixtureState {
  return {
    users: new Map(
      (Object.keys(SEED_USERS) as SeedUserId[]).map(id => [id, SEED_USERS[id]])
    ),
    revisions: SEEDED_REVISIONS.reduce<RevisionStore>(
      (store, [userId, revision]) =>
        store.set(userId, [...(store.get(userId) ?? []), revision]),
      new Map()
    ),
    current: new Map(),
    contacts: new Map(SEEDED_CONTACTS.map(request => [request.id, request])),
    hiddenLinks: new Set(),
  };
}

type Schemas = components["schemas"];

const BEARER = /^Bearer fixture:([a-z0-9-]+)$/;

const UNAUTHENTICATED: FixtureResponse = {
  status: 401,
  body: errorBody("unauthenticated", "invalid credentials"),
};

const EDITABLE = {
  getEditablePiece: { type: "piece", path: "/v1/pieces/{slug}/editable" },
  getEditablePerson: { type: "person", path: "/v1/persons/{slug}/editable" },
  getEditableTerm: { type: "term", path: "/v1/terms/{slug}/editable" },
  getEditableEvent: { type: "event", path: "/v1/events/{slug}/editable" },
  getEditableCollection: {
    type: "collection",
    path: "/v1/collections/{collection_id}/editable",
  },
} as const;

/** A JSON body as the spec allows it, or the 400 it gets. */
function bodyOf(
  operationId: string,
  request: FixtureRequest
): { readonly body: unknown } | FixtureResponse {
  const body: unknown =
    request.body === "" ? undefined : JSON.parse(request.body);
  const problems =
    body === undefined
      ? []
      : requestProblems(operationId as keyof operations, body);
  return problems.length > 0
    ? { status: 400, body: errorBody("invalid_request", problems.join("; ")) }
    : { body };
}

/** The signed-in user's operations: theirs, or a 401. */
function signedIn(
  state: FixtureState,
  operationId: string,
  request: FixtureRequest,
  params: Record<string, string>
): FixtureResponse {
  const id = BEARER.exec(request.authorization ?? "")?.[1] ?? "";
  const user = state.users.get(id);
  if (!user) return UNAUTHENTICATED;
  const parsed = bodyOf(operationId, request);
  if ("status" in parsed) return parsed;
  const { body } = parsed;
  const query = new URLSearchParams(request.search);
  switch (operationId) {
    case "updateMe": {
      const { display_name } = body as { display_name: string };
      state.users.set(id, { ...user, display_name });
      return { status: 200, body: state.users.get(id) };
    }
    case "submitRevision":
      return submitRevision(
        state.revisions,
        state.current,
        user,
        body as components["schemas"]["SubmitRevisionRequest"]
      );
    case "listMyRevisions":
      return listMyRevisions(state.revisions, user, query);
    case "withdrawRevision":
      return withdrawRevision(state.revisions, user, params.revision_id ?? "");
    case "getMe":
      return { status: 200, body: user };
    case "listModerationQueue":
      return listModerationQueue(state, user, query);
    case "getModerationRevision":
      return getModerationRevision(state, user, params.revision_id ?? "");
    case "approveRevision":
      return approveRevision(
        state,
        user,
        params.revision_id ?? "",
        body as Schemas["ApproveRevisionRequest"]
      );
    case "rejectRevision":
      return rejectRevision(
        state,
        user,
        params.revision_id ?? "",
        body as Schemas["RejectRevisionRequest"]
      );
    case "listContactRequests":
      return listContactRequests(state, user, query);
    case "closeContactRequest":
      return closeContactRequest(
        state,
        user,
        params.request_id ?? "",
        body as Schemas["CloseContactRequestRequest"]
      );
    case "getModerationLink":
      return getModerationLink(state, user, query);
    case "setLinkHidden":
      return setLinkHidden(
        state,
        user,
        params.link_id ?? "",
        body as Schemas["SetLinkHiddenRequest"]
      );
    case "setUserBlocked":
      return setUserBlocked(state, user, params.user_id ?? "");
    default: {
      const { type } = EDITABLE[operationId as keyof typeof EDITABLE];
      return getEditable(
        state.current,
        type,
        params.slug ?? params.collection_id ?? ""
      );
    }
  }
}

const ROUTES = [
  { operationId: "getHealthz", method: "GET", path: "/healthz" },
  { operationId: "getMe", method: "GET", path: "/v1/me" },
  { operationId: "updateMe", method: "PATCH", path: "/v1/me" },
  { operationId: "submitRevision", method: "POST", path: "/v1/revisions" },
  { operationId: "listMyRevisions", method: "GET", path: "/v1/me/revisions" },
  {
    operationId: "withdrawRevision",
    method: "POST",
    path: "/v1/revisions/{revision_id}/withdraw",
  },
  {
    operationId: "listModerationQueue",
    method: "GET",
    path: "/v1/moderation/queue",
  },
  {
    operationId: "getModerationRevision",
    method: "GET",
    path: "/v1/moderation/revisions/{revision_id}",
  },
  {
    operationId: "approveRevision",
    method: "POST",
    path: "/v1/revisions/{revision_id}/approve",
  },
  {
    operationId: "rejectRevision",
    method: "POST",
    path: "/v1/revisions/{revision_id}/reject",
  },
  {
    operationId: "listContactRequests",
    method: "GET",
    path: "/v1/moderation/contact-requests",
  },
  {
    operationId: "closeContactRequest",
    method: "POST",
    path: "/v1/moderation/contact-requests/{request_id}",
  },
  {
    operationId: "getModerationLink",
    method: "GET",
    path: "/v1/moderation/links",
  },
  {
    operationId: "setLinkHidden",
    method: "PUT",
    path: "/v1/links/{link_id}/hidden",
  },
  {
    operationId: "setUserBlocked",
    method: "PUT",
    path: "/v1/users/{user_id}/blocked",
  },
  { operationId: "createContactRequest", method: "POST", path: "/v1/contact" },
  ...Object.entries(EDITABLE).map(([operationId, { path }]) => ({
    operationId,
    method: "GET",
    path,
  })),
  ...Object.entries(CATALOGUE_READS).map(([operationId, { path }]) => ({
    operationId,
    method: "GET",
    path,
  })),
] as const;

function answer(
  state: FixtureState,
  operationId: string,
  request: FixtureRequest,
  params: Record<string, string>
): FixtureResponse {
  if (operationId === "getHealthz") {
    return { status: 200, body: { status: "ok" } };
  }
  if (operationId === "createContactRequest") {
    const parsed = bodyOf(operationId, request);
    return "status" in parsed
      ? parsed
      : createContactRequest(
          state,
          parsed.body as Schemas["CreateContactRequest"]
        );
  }
  if (operationId in CATALOGUE_READS) {
    return CATALOGUE_READS[operationId as keyof typeof CATALOGUE_READS].read(
      params,
      new URLSearchParams(request.search)
    );
  }
  return signedIn(state, operationId, request, params);
}

export function handleFixtureRequest(
  state: FixtureState,
  request: FixtureRequest
): FixtureResponse {
  for (const { operationId, method, path } of ROUTES) {
    const names: string[] = [];
    const pattern = path.replace(/\{(\w+)\}/g, (_match, name: string) => {
      names.push(name);
      return "([^/]+)";
    });
    const match = new RegExp(`^${pattern}$`).exec(request.pathname);
    if (method !== request.method || !match) continue;
    const params = Object.fromEntries(
      names.map((name, i) => [name, decodeURIComponent(match[i + 1] ?? "")])
    );
    const response = answer(state, operationId, request, params);
    const problems = responseProblems(
      operationId as keyof operations,
      response.status,
      response.body
    );
    if (problems.length > 0) {
      throw new Error(
        `Fixture ${operationId} ${response.status} breaks the spec: ${problems.join("; ")}`
      );
    }
    return response;
  }
  return { status: 404, body: errorBody("not_found", "no such route") };
}
