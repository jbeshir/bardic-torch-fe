import type { operations } from "../../app/api/schema.gen";
import { CATALOGUE_READS } from "./catalogue-operations";
import { SEED_USERS, type SeedUserId } from "./data";
import { type ModerationState } from "./moderation-operations";
import { errorBody, type FixtureResponse } from "./responses";
import { responseProblems } from "./spec";

/**
 * Routes a request to the fixture API's canned answers: `getHealthz`, the
 * seeded users' `getMe`, the catalogue reads
 * (catalogue-operations.ts). A request is signed in by the bearer the app
 * sends for a stub session, exactly `Bearer fixture:<userId>`;
 * anything else is 401.
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
};

export function createFixtureState(): FixtureState {
  return {
    users: new Map(
      (Object.keys(SEED_USERS) as SeedUserId[]).map(id => [id, SEED_USERS[id]])
    ),
  };
}

const BEARER = /^Bearer fixture:([a-z0-9-]+)$/;

const UNAUTHENTICATED: FixtureResponse = {
  status: 401,
  body: errorBody("unauthenticated", "invalid credentials"),
};

/** The signed-in user's operations: theirs, or a 401. */
function signedIn(
  state: FixtureState,
  request: FixtureRequest
): FixtureResponse {
  const id = BEARER.exec(request.authorization ?? "")?.[1] ?? "";
  const user = state.users.get(id);
  if (!user) return UNAUTHENTICATED;
  return { status: 200, body: user };
}

const ROUTES = [
  { operationId: "getHealthz", method: "GET", path: "/healthz" },
  { operationId: "getMe", method: "GET", path: "/v1/me" },
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
  if (operationId in CATALOGUE_READS) {
    return CATALOGUE_READS[operationId as keyof typeof CATALOGUE_READS].read(
      params,
      new URLSearchParams(request.search)
    );
  }
  return signedIn(state, request);
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
