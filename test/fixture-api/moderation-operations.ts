import type { components } from "../../app/api/schema.gen";
import { type FixtureResponse } from "./responses";

/**
 * The fixture API's contact form.
 */

type Schemas = components["schemas"];
type User = Schemas["User"];

export type ModerationState = {
  readonly users: Map<string, User>;
  readonly contacts: Map<number, Schemas["ContactRequest"]>;
};

const NOW = "2026-11-01T12:00:00Z";

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
