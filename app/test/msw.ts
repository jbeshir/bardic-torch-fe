import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";
import {
  createFixtureState,
  handleFixtureRequest,
  type FixtureState,
} from "../../test/fixture-api/router";
import { API_BASE_URL } from "./context";

/**
 * msw handlers that answer every request to `baseUrl` from the fixture API's
 * operation table, so loader and action tests see the same behaviour as the
 * e2e fixture server.
 */
function fixtureHandlers(state: FixtureState, baseUrl = API_BASE_URL) {
  return [
    http.all(`${baseUrl}/*`, async ({ request }) => {
      const result = handleFixtureRequest(state, {
        method: request.method,
        pathname: new URL(request.url).pathname,
        authorization: request.headers.get("Authorization"),
        contentType: request.headers.get("Content-Type"),
        body: await request.text(),
      });
      return result.body === undefined
        ? new HttpResponse(null, { status: result.status })
        : HttpResponse.json(result.body, { status: result.status });
    }),
  ];
}

/**
 * Serve the fixture API through msw for the current test file. State is
 * fresh for every test; unhandled requests fail the test.
 */
export function serveFixtureApi() {
  let state = createFixtureState();
  const server = setupServer(...fixtureHandlers(state));

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    state = createFixtureState();
    server.resetHandlers(...fixtureHandlers(state));
  });
  afterAll(() => server.close());

  return {
    /** The current test's fixture state. */
    state: () => state,
  };
}
