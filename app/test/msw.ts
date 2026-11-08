import type { RequestHandler } from "msw";
import { HttpNetworkFrame } from "msw/experimental";
import { http, HttpResponse } from "msw/http";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect } from "vitest";
import {
  addFailure,
  createFixtureState,
  handleFixtureRequest,
  type FixtureState,
} from "../../test/fixture-api/router";
import { API_BASE_URL } from "./context";

/**
 * An msw server for the current test file, listening for the whole file.
 * A request no handler answers is refused (its fetch rejects) **and** fails
 * the test that made it: the code under test usually turns a rejected fetch
 * into a 502, which would otherwise let a test pass for the wrong reason.
 * Handlers added with `server.use()` last for one test.
 */
export function serveMocks(...handlers: RequestHandler[]) {
  const server = setupServer(...handlers);
  const unhandled: string[] = [];

  beforeAll(() =>
    server.listen({
      onUnhandledFrame({ frame, defaults }) {
        const { request } = frame instanceof HttpNetworkFrame ? frame.data : {};
        unhandled.push(
          request
            ? `${request.method} ${request.url}`
            : `${frame.protocol} frame`
        );
        defaults.error();
      },
    })
  );
  afterEach(() => {
    const seen = unhandled.splice(0);
    server.resetHandlers();
    expect(seen, "requests no msw handler answered").toEqual([]);
  });
  afterAll(() => server.close());

  return {
    server,
    /**
     * The unhandled requests so far, which then no longer fail the test:
     * for a test that makes one on purpose.
     */
    takeUnhandled: () => unhandled.splice(0),
  };
}

/**
 * msw handlers that answer every request to `baseUrl` from the fixture API's
 * operation table, so loader and action tests see the same behaviour as the
 * e2e fixture server.
 */
function fixtureHandlers(state: () => FixtureState, baseUrl = API_BASE_URL) {
  return [
    http.all(`${baseUrl}/*`, async ({ request }) => {
      const { pathname, search } = new URL(request.url);
      const result = handleFixtureRequest(state(), {
        method: request.method,
        pathname,
        search,
        authorization: request.headers.get("Authorization"),
        contentType: request.headers.get("Content-Type"),
        body: await request.text(),
      });
      if (result.body === undefined) {
        return new HttpResponse(null, { status: result.status });
      }
      if (result.contentType !== undefined) {
        return new HttpResponse(String(result.body), {
          status: result.status,
          headers: { "Content-Type": result.contentType },
        });
      }
      return HttpResponse.json(result.body, { status: result.status });
    }),
  ];
}

/**
 * Serve the fixture API through msw for the current test file. State is
 * fresh for every test; unhandled requests fail the test.
 */
export function serveFixtureApi() {
  let state = createFixtureState();
  const mocks = serveMocks(...fixtureHandlers(() => state));

  afterEach(() => {
    state = createFixtureState();
  });

  return {
    /** The current test's fixture state. */
    state: () => state,
    /** Queue a failure in the current test's state (see `addFailure`). */
    fail: (failure: Parameters<typeof addFailure>[1]) =>
      addFailure(state, failure),
    ...mocks,
  };
}
