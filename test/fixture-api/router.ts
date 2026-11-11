import type { components, operations } from "../../app/api/schema.gen";
import { CATALOGUE_READS } from "./catalogue-operations";
import { SEED_USERS, type SeedUserId } from "./data";
import { errorBody, type FixtureResponse } from "./responses";
import { responseProblems } from "./spec";

/**
 * Routes a request to the fixture API's canned answers: `getHealthz`, the
 * seeded users' `getMe` and `updateMe`, and the catalogue reads
 * (catalogue-operations.ts). A request is signed in by the bearer the app
 * sends for a stub session, exactly `Bearer auth0|fixture:<userId>`;
 * anything else is 401. A renamed user is remembered in the state.
 *
 * Every answer is validated against the spec; a fixture that breaks the
 * contract throws instead of answering. It follows no backend rule beyond
 * what the read pages need: an unknown entity is 404, and a `term` or
 * `affiliation` that no listed term has is 400.
 */

export type FixtureState = Map<string, components["schemas"]["User"]>;

type FixtureRequest = {
  readonly method: string;
  readonly pathname: string;
  /** The raw query string, `?…` or empty (`URL.search`). */
  readonly search: string;
  readonly authorization: string | null;
  readonly body: string;
};

export function createFixtureState(): FixtureState {
  return new Map(
    (Object.keys(SEED_USERS) as SeedUserId[]).map(id => [id, SEED_USERS[id]])
  );
}

const BEARER = /^Bearer auth0\|fixture:([a-z0-9-]+)$/;

function me(state: FixtureState, request: FixtureRequest): FixtureResponse {
  const id = BEARER.exec(request.authorization ?? "")?.[1] ?? "";
  const user = state.get(id);
  if (!user) {
    return {
      status: 401,
      body: errorBody("unauthenticated", "invalid credentials"),
    };
  }
  if (request.method === "PATCH") {
    const { display_name } = JSON.parse(request.body) as {
      display_name: string;
    };
    state.set(id, { ...user, display_name });
  }
  return { status: 200, body: state.get(id) };
}

const ROUTES = [
  { operationId: "getHealthz", method: "GET", path: "/healthz" },
  { operationId: "getMe", method: "GET", path: "/v1/me" },
  { operationId: "updateMe", method: "PATCH", path: "/v1/me" },
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
  if (operationId === "getMe" || operationId === "updateMe") {
    return me(state, request);
  }
  return CATALOGUE_READS[operationId as keyof typeof CATALOGUE_READS].read(
    params,
    new URLSearchParams(request.search)
  );
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
