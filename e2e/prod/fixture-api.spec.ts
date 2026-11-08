import { expect } from "@playwright/test";
import { FIXTURE_API_URL, failNext, outageNext } from "../support/fixture-api";
import { test } from "../support/test";

/**
 * The e2e helpers against the fixture server every worker shares: a public
 * operation's failure or outage fires only for the request its `match`
 * names, so parallel tests never see each other's. Page journeys use the
 * same helpers through the app (docs/TESTING.md, "The fixture API").
 */

test("failNext with a match fails only the matching public request", async ({
  request,
}) => {
  await failNext(request, {
    operationId: "listPieces",
    status: 500,
    code: "internal",
    match: { q: "e2e-fixture-fail-1" },
  });
  const other = await request.get(`${FIXTURE_API_URL}/v1/pieces?q=other`);
  expect(other.status()).not.toBe(500);
  const matching = await request.get(
    `${FIXTURE_API_URL}/v1/pieces?q=e2e-fixture-fail-1`
  );
  expect(matching.status()).toBe(500);
  expect(await matching.json()).toEqual({
    code: "internal",
    message: "injected failure",
  });
});

test("outageNext answers what a proxy would, outside the spec", async ({
  request,
}) => {
  await outageNext(request, {
    operationId: "getPiece",
    match: { slug: "e2e-fixture-outage-1" },
    mode: "503",
  });
  const response = await request.get(
    `${FIXTURE_API_URL}/v1/pieces/e2e-fixture-outage-1`
  );
  expect(response.status()).toBe(503);
  expect(response.headers()["content-type"]).toBe("text/plain; charset=utf-8");
});
