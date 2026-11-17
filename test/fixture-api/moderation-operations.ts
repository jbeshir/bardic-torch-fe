import type { components } from "../../app/api/schema.gen";
import { REVISIONS } from "./catalogue/revisions";
import { SEED_USERS } from "./data";
import { type RevisionStore } from "./editing-operations";
import { type FixtureResponse } from "./responses";

/**
 * The fixture API's contact form.
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
};

const NOW = "2026-11-01T12:00:00Z";

const canned = (id: number) => REVISIONS.find(r => r.id === id)!;

export const SEEDED_REVISIONS: readonly (readonly [string, RevisionView])[] = [
  [
    SEED_USERS.contributor.id,
    {
      ...canned(1007),
      id: 1903,
      summary: "Filled in Wren’s profile",
      author: { display_name: SEED_USERS.contributor.display_name },
      contributors: [],
      created_at: "2026-10-18T14:00:00Z",
      status: "rejected",
      review_note: "Please say where the profile’s details come from.",
      reviewed_at: "2026-10-19T10:00:00Z",
    },
  ],
];

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
