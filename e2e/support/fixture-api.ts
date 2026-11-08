import { expect, type APIRequestContext } from "@playwright/test";

/** Where Playwright's webServer runs the fixture API (test/fixture-api). */
export const FIXTURE_API_PORT = 4010;
export const FIXTURE_API_URL = `http://127.0.0.1:${FIXTURE_API_PORT}`;

/**
 * Path or query parameters a request must have for a failure or outage to
 * fire, e.g. `{slug: "e2e-500-a1"}` or `{q: "timeout-7f2"}`. Workers share
 * the fixture server, so a public operation's must be unique to the test.
 */
type Match = Readonly<Record<string, string>>;

/** Create an isolated fixture user, so specs never share state. */
export async function createFixtureUser(
  request: APIRequestContext,
  options: Record<string, unknown> = {}
): Promise<string> {
  const response = await request.post(`${FIXTURE_API_URL}/__fixtures/users`, {
    data: options,
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

/**
 * Make the fixture API fail `operationId` `times` times: for `userId`
 * (authenticated operations), or for requests with every `match` pair
 * (required for public operations).
 */
export async function failNext(
  request: APIRequestContext,
  failure: {
    operationId: string;
    status: number;
    code: string;
    times?: number;
  } & ({ userId: string; match?: Match } | { match: Match })
): Promise<void> {
  const response = await request.post(`${FIXTURE_API_URL}/__fixtures/fail`, {
    data: failure,
  });
  expect(response.ok()).toBe(true);
}

/**
 * Make the next `times` requests to a public operation with every `match`
 * pair get what a proxy sends when the backend is down: a plain-text 503
 * or an HTML 502, outside the spec.
 */
export async function outageNext(
  request: APIRequestContext,
  outage: {
    operationId: string;
    match: Match;
    mode: "503" | "html-502";
    times?: number;
  }
): Promise<void> {
  const response = await request.post(`${FIXTURE_API_URL}/__fixtures/outage`, {
    data: outage,
  });
  expect(response.ok()).toBe(true);
}
