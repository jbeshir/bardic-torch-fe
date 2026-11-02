import { HttpResponse } from "msw/http";
import { expect } from "vitest";
import type { operations } from "~/api/schema.gen";
import { responseProblems } from "../../test/fixture-api/spec";

/**
 * Upstream answers for msw handlers in loader, action and API-client
 * tests, checked against api/openapi.yaml (with the fixture API's
 * validator) so they cannot drift from the contract after `sync:api`.
 * Every JSON body a handler for the API sends goes through one of these:
 *
 * - `contractResponse` for an answer the contract declares;
 * - `offContractResponse` for one it does not, which a test sends on purpose
 *   to see how the app copes with a misbehaving API. It must really be off
 *   the contract, and says why.
 *
 * A wrong body fails the test that built it with a soft assertion: an
 * error thrown in a handler would only reach the test as msw's 500.
 */

type OperationId = keyof operations;

/**
 * Why an answer is in the wrong helper, if it is: a declared answer that
 * the contract forbids, or an off-contract one that it actually allows.
 */
export function contractMisuse(
  expected: "declared" | "off-contract",
  operationId: OperationId,
  status: number,
  body: unknown
): string | undefined {
  const problems = responseProblems(operationId, status, body);
  if (expected === "declared" && problems.length > 0) {
    return `${operationId} ${status} is not what api/openapi.yaml declares: ${problems.join("; ")}`;
  }
  if (expected === "off-contract" && problems.length === 0) {
    return `${operationId} ${status} is marked off-contract but api/openapi.yaml allows it`;
  }
  return undefined;
}

function respond(
  expected: "declared" | "off-contract",
  operationId: OperationId,
  status: number,
  body: unknown
): Response {
  expect
    .soft(contractMisuse(expected, operationId, status, body))
    .toBeUndefined();
  return body === undefined
    ? new HttpResponse(null, { status })
    : HttpResponse.json(body, { status });
}

/** The `status` answer of `operationId`, as the contract declares it. */
export function contractResponse(
  operationId: OperationId,
  status: number,
  body?: unknown
): Response {
  return respond("declared", operationId, status, body);
}

/**
 * A JSON answer to `operationId` that breaks the contract (`why` says how),
 * for testing the app's handling of it.
 */
export function offContractResponse(
  operationId: OperationId,
  status: number,
  body: unknown,
  why: string
): Response {
  expect.soft(why.trim(), "why the answer is off-contract").not.toBe("");
  return respond("off-contract", operationId, status, body);
}
