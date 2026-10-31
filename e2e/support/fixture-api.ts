import { expect, type APIRequestContext } from "@playwright/test";

/** Where Playwright's webServer runs the fixture API (test/fixture-api). */
export const FIXTURE_API_PORT = 4010;
export const FIXTURE_API_URL = `http://127.0.0.1:${FIXTURE_API_PORT}`;

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

/** Make the fixture API fail `operationId` for `userId`, `times` times. */
export async function failNext(
  request: APIRequestContext,
  failure: {
    userId: string;
    operationId: string;
    status: number;
    code: string;
    times?: number;
  }
): Promise<void> {
  const response = await request.post(`${FIXTURE_API_URL}/__fixtures/fail`, {
    data: failure,
  });
  expect(response.ok()).toBe(true);
}
